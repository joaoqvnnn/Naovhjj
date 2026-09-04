import { Router, Request, Response } from 'express';
import prisma from '../database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config';
import { generateRandomCode, isValidEmail, isValidPixKey } from '../utils/format';
import { sendPasswordResetCode } from '../services/email';
import { generatePasswordResetCode, validatePasswordResetCode, resetPassword } from '../services/passwordReset';
import { passwordResetRateLimit } from '../middlewares/passwordResetRateLimit';
import { logAction } from '../services/logger';
import { renderPage } from './layout';
import { canAccessActivation, incrementAccessCount, getAccessLimit } from '../services/activation';
import { banksFull, getFullBankOptionsHtml } from '../data/banksComplete';

const router = Router();

function authMiddleware(req: Request, res: Response, next: Function) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Não autorizado' });
  try {
    const decoded = jwt.verify(token, config.web.secret) as { userId: number };
    (req as any).userId = decoded.userId;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

// ==============================
// ATIVAÇÃO DE PRODUTO
// ==============================

router.get('/ativar/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const order = await prisma.order.findUnique({
    where: { id: parseInt(orderId) },
    include: { product: true, stockUnits: true },
  });

  if (!order) {
    const content = `<p class="error">Pedido não encontrado.</p>`;
    return res.status(404).send(renderPage('Ativar Produto', content));
  }

  // Verifica limite de acesso
  const allowed = await canAccessActivation(order.id);
  if (!allowed) {
    const content = `<p class="error">Limite de acessos atingido para este pedido.</p>`;
    return res.status(403).send(renderPage('Acesso Limitado', content));
  }

  const content = `
    <p>Produto: <strong>${order.product.name}</strong></p>
    <p>Digite a senha para liberar o conteúdo:</p>
    <form method="POST" action="/web/ativar/${order.id}">
      <input type="password" name="senha" placeholder="Senha" required />
      <button type="submit">Ativar</button>
    </form>
    <p class="error">${req.query.erro ? 'Senha incorreta' : ''}</p>
    <p><a href="/web/esqueci-senha">Esqueci a senha</a></p>
  `;
  res.send(renderPage('Ativar Produto', content));
});

router.post('/ativar/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const { senha } = req.body;

  const order = await prisma.order.findUnique({
    where: { id: parseInt(orderId) },
    include: { user: true, product: true, stockUnits: true },
  });

  if (!order) {
    return res.status(404).send(renderPage('Erro', '<p class="error">Pedido não encontrado.</p>'));
  }

  if (!order.user.passwordHash) {
    return res.redirect(`/web/definir-senha?orderId=${order.id}`);
  }

  const valid = await bcrypt.compare(senha, order.user.passwordHash);
  if (!valid) {
    return res.redirect(`/web/ativar/${order.id}?erro=1`);
  }

  // Incrementa contador de acesso
  await incrementAccessCount(order.id);

  const conteudo = order.stockUnits.map(u => u.content).join('\n');
  const content = `
    <h2>Conteúdo liberado</h2>
    <p>Produto: ${order.product.name}</p>
    <pre>${conteudo}</pre>
    <p class="success">Acesso registrado. Restam ${Math.max(0, (order.maxAccess || await getAccessLimit(order.id)) - (order.accessCount + 1))} acessos.</p>
  `;
  res.send(renderPage('Produto Liberado', content, false));
});

// Definir senha pela primeira vez
router.get('/definir-senha', async (req, res) => {
  const { orderId } = req.query;
  const content = `
    <form method="POST" action="/web/definir-senha">
      <input type="hidden" name="orderId" value="${orderId || ''}" />
      <input type="password" name="senha" placeholder="Nova senha" required />
      <button type="submit">Salvar</button>
    </form>
  `;
  res.send(renderPage('Definir Senha', content));
});

router.post('/definir-senha', async (req, res) => {
  const { orderId, senha } = req.body;
  const order = await prisma.order.findUnique({
    where: { id: parseInt(orderId) },
    include: { user: true },
  });
  if (!order) return res.status(404).send('Pedido não encontrado');
  const hashed = await bcrypt.hash(senha, 10);
  await prisma.user.update({
    where: { id: order.user.id },
    data: { passwordHash: hashed },
  });
  res.redirect(`/web/ativar/${orderId}`);
});

// ==============================
// RECUPERAÇÃO DE SENHA
// ==============================

router.get('/esqueci-senha', (req, res) => {
  const content = `
    <p>Digite seu e-mail cadastrado para receber um código de recuperação.</p>
    <form method="POST" action="/web/esqueci-senha">
      <input type="email" name="email" placeholder="Seu e-mail" required />
      <button type="submit">Enviar código</button>
    </form>
    <p><a href="/web/login">Voltar ao login</a></p>
  `;
  res.send(renderPage('Recuperar Senha', content));
});

router.post('/esqueci-senha', passwordResetRateLimit, async (req, res) => {
  const { email } = req.body;
  if (!email || !isValidEmail(email)) {
    return res.status(400).send(renderPage('Erro', '<p class="error">E-mail inválido.</p>'));
  }

  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    const content = '<p class="success">Se o e-mail estiver cadastrado, você receberá um código em instantes.</p>';
    return res.send(renderPage('Recuperar Senha', content));
  }

  const code = await generatePasswordResetCode(user.id);
  const sent = await sendPasswordResetCode(email, code);
  if (!sent) {
    const content = '<p class="error">Erro ao enviar e-mail. Tente novamente mais tarde.</p>';
    return res.status(500).send(renderPage('Erro', content));
  }

  const content = '<p class="success">Código enviado para seu e-mail. Verifique sua caixa de entrada.</p>';
  res.send(renderPage('Recuperar Senha', content));
});

router.get('/redefinir-senha', (req, res) => {
  const content = `
    <form method="POST" action="/web/redefinir-senha">
      <input type="email" name="email" placeholder="Seu e-mail" required />
      <input type="text" name="codigo" placeholder="Código de 6 dígitos" required />
      <input type="password" name="novaSenha" placeholder="Nova senha" required />
      <button type="submit">Redefinir</button>
    </form>
  `;
  res.send(renderPage('Redefinir Senha', content));
});

router.post('/redefinir-senha', async (req, res) => {
  const { email, codigo, novaSenha } = req.body;
  if (!email || !codigo || !novaSenha) {
    return res.status(400).send(renderPage('Erro', '<p class="error">Preencha todos os campos.</p>'));
  }
  if (!isValidEmail(email)) {
    return res.status(400).send(renderPage('Erro', '<p class="error">E-mail inválido.</p>'));
  }

  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    return res.status(400).send(renderPage('Erro', '<p class="error">Usuário não encontrado.</p>'));
  }

  const valid = await validatePasswordResetCode(user.id, codigo);
  if (!valid) {
    return res.status(400).send(renderPage('Erro', '<p class="error">Código inválido ou expirado.</p>'));
  }

  if (novaSenha.length < 6) {
    return res.status(400).send(renderPage('Erro', '<p class="error">A senha deve ter no mínimo 6 caracteres.</p>'));
  }

  await resetPassword(user.id, novaSenha);

  const content = '<h2>✅ Senha redefinida com sucesso!</h2><p>Você já pode usar sua nova senha em todos os serviços.</p>';
  res.send(renderPage('Senha Redefinida', content, false));
});

// ==============================
// SAQUE BANCÁRIO (Web)
// ==============================

router.get('/saque', (req, res) => {
  const content = `
    <p>Faça login com seu Telegram ID e senha para acessar o saque bancário.</p>
    <form method="POST" action="/web/saque/login">
      <input type="text" name="telegramId" placeholder="Telegram ID" required />
      <input type="password" name="senha" placeholder="Senha" required />
      <button type="submit">Entrar</button>
    </form>
  `;
  res.send(renderPage('Saque Bancário', content));
});

router.post('/saque/login', async (req, res) => {
  const { telegramId, senha } = req.body;
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
  });
  if (!user || !user.passwordHash) {
    return res.status(401).send(renderPage('Erro', '<p class="error">Credenciais inválidas</p>'));
  }
  const valid = await bcrypt.compare(senha, user.passwordHash);
  if (!valid) {
    return res.status(401).send(renderPage('Erro', '<p class="error">Credenciais inválidas</p>'));
  }

  const token = jwt.sign({ userId: user.id }, config.web.secret, { expiresIn: '15m' });

  const content = `
    <p>Saldo de comissão: <strong>R$ ${user.affiliateBalance}</strong></p>
    <form method="POST" action="/web/saque/processar">
      <input type="hidden" name="token" value="${token}" />
      <label>Valor:</label>
      <input type="number" step="0.01" name="valor" required />
      <label>Banco:</label>
      <select name="banco" required>
        ${getFullBankOptionsHtml()}
      </select>
      <label>Agência:</label>
      <input type="text" name="agencia" required />
      <label>Conta:</label>
      <input type="text" name="conta" required />
      <label>Tipo de conta:</label>
      <select name="tipo" required>
        <option value="CORRENTE">Corrente</option>
        <option value="POUPANCA">Poupança</option>
      </select>
      <label>CPF/CNPJ:</label>
      <input type="text" name="cpfCnpj" required />
      <label>Titular:</label>
      <input type="text" name="titular" required />
      <button type="submit">Solicitar Saque</button>
    </form>
  `;
  res.send(renderPage('Saque Bancário', content));
});

router.post('/saque/processar', async (req, res) => {
  const { token, valor, banco, agencia, conta, tipo, cpfCnpj, titular } = req.body;
  try {
    const decoded = jwt.verify(token, config.web.secret) as { userId: number };
    const userId = decoded.userId;
    const amount = parseFloat(valor);
    if (isNaN(amount) || amount <= 0) return res.status(400).send(renderPage('Erro', '<p class="error">Valor inválido</p>'));

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).send(renderPage('Erro', '<p class="error">Usuário não encontrado</p>'));
    if (user.affiliateBalance < amount) return res.status(400).send(renderPage('Erro', '<p class="error">Saldo insuficiente</p>'));

    await prisma.withdrawal.create({
      data: {
        userId,
        amount,
        fee: 0,
        netAmount: amount,
        method: 'BANK_TRANSFER',
        bankDetails: { banco, agencia, conta, tipo, cpfCnpj, titular },
        status: 'PENDING',
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { affiliateBalance: { decrement: amount } },
    });

    const content = '<p class="success">Solicitação de saque enviada com sucesso. Aguarde processamento.</p>';
    res.send(renderPage('Saque Solicitado', content, false));
  } catch (error) {
    console.error('Erro no processamento de saque:', error);
    res.status(400).send(renderPage('Erro', '<p class="error">Erro ao processar saque</p>'));
  }
});

// ==============================
// HISTÓRICO DE SAQUES (autenticado)
// ==============================

router.get('/saque/historico', authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const withdrawals = await prisma.withdrawal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  let lista = withdrawals.map(w => `<li>#${w.id} - R$ ${w.amount} - ${w.status} - ${w.createdAt.toLocaleDateString('pt-BR')}</li>`).join('');
  if (!lista) lista = '<li>Nenhum saque realizado.</li>';
  const content = `<ul>${lista}</ul>`;
  res.send(renderPage('Histórico de Saques', content));
});

// ==============================
// TERMOS (página configurável)
// ==============================

router.get('/termos', async (req, res) => {
  const template = await prisma.messageTemplate.findUnique({ where: { key: 'termos' } });
  const texto = template?.text || 'Termos de uso não configurados.';
  const content = `<div>${texto.replace(/\n/g, '<br>')}</div>`;
  res.send(renderPage('Termos de Uso', content));
});

export default router;
