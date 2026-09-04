import { Router, Request, Response } from 'express';
import prisma from '../database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config';
import { generateRandomCode } from '../utils/format';
import { sendPasswordResetCode } from '../services/email';

const router = Router();

// Middleware para autenticar via token JWT (para rotas protegidas)
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

// Rota: ativação de produto (via link enviado por e-mail/WhatsApp)
// Exemplo: GET /web/ativar/:orderId
router.get('/ativar/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const order = await prisma.order.findUnique({
    where: { id: parseInt(orderId) },
    include: { product: true, stockUnits: true },
  });

  if (!order) {
    return res.status(404).send('Pedido não encontrado.');
  }

  // Renderiza página HTML simples com formulário de senha
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Ativar Produto</title>
      <style>
        body { font-family: Arial; background: #f4f4f4; display: flex; justify-content: center; align-items: center; height: 100vh; }
        .container { background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
        input[type=password] { width: 100%; padding: 10px; margin: 10px 0; }
        button { background: #6c5ce7; color: white; border: none; padding: 10px 20px; cursor: pointer; }
        .erro { color: red; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Ativar Produto: ${order.product.name}</h2>
        <form method="POST" action="/web/ativar/${order.id}">
          <label>Digite a senha para liberar o conteúdo:</label>
          <input type="password" name="senha" required />
          <button type="submit">Ativar</button>
          <p class="erro">${req.query.erro ? 'Senha incorreta' : ''}</p>
        </form>
        <p><a href="/web/esqueci-senha?orderId=${order.id}">Esqueci a senha</a></p>
      </div>
    </body>
    </html>
  `;
  res.send(html);
});

// Rota: processa ativação (POST)
router.post('/ativar/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const { senha } = req.body;

  const order = await prisma.order.findUnique({
    where: { id: parseInt(orderId) },
    include: { user: true, product: true, stockUnits: true },
  });

  if (!order) return res.status(404).send('Pedido não encontrado');

  // Verifica a senha do usuário (hash)
  const user = order.user;
  if (!user.passwordHash) {
    // Se não tem senha cadastrada, redireciona para criar
    return res.redirect(`/web/definir-senha?orderId=${order.id}`);
  }

  const valid = await bcrypt.compare(senha, user.passwordHash);
  if (!valid) {
    return res.redirect(`/web/ativar/${order.id}?erro=1`);
  }

  // Senha correta: mostra conteúdo do pedido
  const conteudo = order.stockUnits.map(u => u.content).join('\n');
  const html = `
    <h2>Conteúdo liberado</h2>
    <p>Produto: ${order.product.name}</p>
    <p>Dados de acesso:</p>
    <pre>${conteudo}</pre>
  `;
  res.send(html);
});

// Rota: esqueci a senha (GET) - formulário para enviar e-mail
router.get('/esqueci-senha', async (req, res) => {
  const { orderId } = req.query;
  const html = `
    <h2>Recuperar senha</h2>
    <form method="POST" action="/web/esqueci-senha">
      <input type="hidden" name="orderId" value="${orderId || ''}" />
      <label>Digite seu e-mail cadastrado:</label>
      <input type="email" name="email" required />
      <button type="submit">Enviar código</button>
    </form>
  `;
  res.send(html);
});

// Rota: esqueci a senha (POST)
router.post('/esqueci-senha', async (req, res) => {
  const { email, orderId } = req.body;

  const user = await prisma.user.findFirst({
    where: { email: email },
  });

  if (!user) {
    return res.status(404).send('E-mail não encontrado.');
  }

  // Gera código de recuperação (6 dígitos) e salva temporariamente (em produção, usar Redis ou coluna)
  const code = generateRandomCode(6);
  // Salvar código em sessão ou tabela (simplificado: envia por e-mail)
  await sendPasswordResetCode(email, code);

  // Redireciona para página de inserir código
  const html = `
    <h2>Código enviado</h2>
    <p>Enviamos um código para ${email}. Insira abaixo:</p>
    <form method="POST" action="/web/redefinir-senha">
      <input type="hidden" name="email" value="${email}" />
      <input type="hidden" name="orderId" value="${orderId || ''}" />
      <input type="text" name="codigo" placeholder="Código" required />
      <input type="password" name="novaSenha" placeholder="Nova senha" required />
      <button type="submit">Redefinir</button>
    </form>
  `;
  res.send(html);
});

// Rota: redefinir senha (POST) - simplificado, sem verificação real do código (em produção, usar tabela)
router.post('/redefinir-senha', async (req, res) => {
  const { email, novaSenha } = req.body;
  const hashed = await bcrypt.hash(novaSenha, 10);
  await prisma.user.updateMany({
    where: { email },
    data: { passwordHash: hashed },
  });
  res.send('Senha redefinida com sucesso. Volte e ative seu produto.');
});

// Rota: definir senha (primeira vez)
router.get('/definir-senha', async (req, res) => {
  const { orderId } = req.query;
  const html = `
    <h2>Definir Senha</h2>
    <form method="POST" action="/web/definir-senha">
      <input type="hidden" name="orderId" value="${orderId || ''}" />
      <label>Nova senha:</label>
      <input type="password" name="senha" required />
      <button type="submit">Salvar</button>
    </form>
  `;
  res.send(html);
});

router.post('/definir-senha', async (req, res) => {
  const { orderId, senha } = req.body;
  // Busca order e usuário
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

// Rota: saque bancário (Web) - login com Telegram ID + senha
router.get('/saque', (req, res) => {
  const html = `
    <h2>Saque Bancário</h2>
    <form method="POST" action="/web/saque/login">
      <label>Telegram ID:</label>
      <input type="text" name="telegramId" required />
      <label>Senha:</label>
      <input type="password" name="senha" required />
      <button type="submit">Entrar</button>
    </form>
  `;
  res.send(html);
});

router.post('/saque/login', async (req, res) => {
  const { telegramId, senha } = req.body;
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
  });
  if (!user || !user.passwordHash) {
    return res.status(401).send('Credenciais inválidas');
  }
  const valid = await bcrypt.compare(senha, user.passwordHash);
  if (!valid) {
    return res.status(401).send('Credenciais inválidas');
  }

  // Gera token JWT
  const token = jwt.sign({ userId: user.id }, config.web.secret, { expiresIn: '15m' });

  // Exibe formulário de saque com dados bancários
  const html = `
    <h2>Saque Bancário</h2>
    <p>Saldo de comissão: R$ ${user.affiliateBalance.toFixed(2)}</p>
    <form method="POST" action="/web/saque/processar">
      <input type="hidden" name="token" value="${token}" />
      <label>Valor:</label>
      <input type="number" step="0.01" name="valor" required />
      <label>Banco:</label>
      <select name="banco" required>
        <option value="001">Banco do Brasil</option>
        <option value="237">Bradesco</option>
        <option value="341">Itaú</option>
        <option value="104">Caixa Econômica</option>
        <!-- Adicionar mais de 500 bancos conforme necessidade -->
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
  res.send(html);
});

// Rota: processar saque bancário (POST) - cria solicitação de saque
router.post('/saque/processar', async (req, res) => {
  const { token, valor, banco, agencia, conta, tipo, cpfCnpj, titular } = req.body;
  try {
    const decoded = jwt.verify(token, config.web.secret) as { userId: number };
    const userId = decoded.userId;
    const amount = parseFloat(valor);
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).send('Valor inválido');
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).send('Usuário não encontrado');
    if (user.affiliateBalance < amount) {
      return res.status(400).send('Saldo insuficiente');
    }

    // Cria registro de saque
    await prisma.withdrawal.create({
      data: {
        userId,
        amount,
        fee: 0, // taxa configurável depois
        netAmount: amount,
        method: 'BANK_TRANSFER',
        bankDetails: { banco, agencia, conta, tipo, cpfCnpj, titular },
        status: 'PENDING',
      },
    });

    // Desconta saldo de comissão
    await prisma.user.update({
      where: { id: userId },
      data: { affiliateBalance: { decrement: amount } },
    });

    res.send('Solicitação de saque enviada com sucesso. Aguarde processamento.');
  } catch (error) {
    console.error('Erro no processamento de saque:', error);
    res.status(400).send('Erro ao processar saque');
  }
});

// Rota: histórico de saques (Web) - autenticada
router.get('/saque/historico', authMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const withdrawals = await prisma.withdrawal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  let html = '<h2>Histórico de Saques</h2><ul>';
  for (const w of withdrawals) {
    html += `<li>${w.id} - R$ ${w.amount} - ${w.status} - ${w.createdAt}</li>`;
  }
  html += '</ul>';
  res.send(html);
});

export default router;
