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

const router = Router();

// Middleware para autenticar via token JWT (rotas protegidas)
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

// Página de ativação (formulário de senha)
router.get('/ativar/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const order = await prisma.order.findUnique({
    where: { id: parseInt(orderId) },
    include: { product: true, stockUnits: true },
  });

  if (!order) {
    return res.status(404).send('Pedido não encontrado.');
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Ativar Produto</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
    .container { background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
    h2 { text-align: center; }
    input[type="password"] { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
    button { width: 100%; padding: 10px; background: #6c5ce7; color: white; border: none; border-radius: 4px; cursor: pointer; }
    .erro { color: red; text-align: center; }
    a { display: block; text-align: center; margin-top: 10px; }
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
    <a href="/web/esqueci-senha">Esqueci a senha</a>
  </div>
</body>
</html>`;
  res.send(html);
});

// Processa ativação
router.post('/ativar/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const { senha } = req.body;

  const order = await prisma.order.findUnique({
    where: { id: parseInt(orderId) },
    include: { user: true, product: true, stockUnits: true },
  });

  if (!order) return res.status(404).send('Pedido não encontrado');

  if (!order.user.passwordHash) {
    return res.redirect(`/web/definir-senha?orderId=${order.id}`);
  }

  const valid = await bcrypt.compare(senha, order.user.passwordHash);
  if (!valid) {
    return res.redirect(`/web/ativar/${order.id}?erro=1`);
  }

  const conteudo = order.stockUnits.map(u => u.content).join('\n');
  const html = `
    <h2>Conteúdo liberado</h2>
    <p>Produto: ${order.product.name}</p>
    <p>Dados de acesso:</p>
    <pre>${conteudo}</pre>
  `;
  res.send(html);
});

// Definir senha pela primeira vez (se ainda não tiver)
router.get('/definir-senha', async (req, res) => {
  const { orderId } = req.query;
  const html = `
    <h2>Definir Senha</h2>
    <form method="POST" action="/web/definir-senha">
      <input type="hidden" name="orderId" value="${orderId || ''}" />
      <input type="password" name="senha" placeholder="Nova senha" required />
      <button type="submit">Salvar</button>
    </form>
  `;
  res.send(html);
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
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Recuperar Senha</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
    .container { background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
    h2 { text-align: center; color: #333; }
    input[type="email"], input[type="text"], input[type="password"] { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
    button { width: 100%; padding: 10px; background: #6c5ce7; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
    button:hover { background: #5a4bd1; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Recuperar Senha</h2>
    <p>Digite seu e-mail cadastrado para receber um código de recuperação.</p>
    <form method="POST" action="/web/esqueci-senha">
      <input type="email" name="email" placeholder="Seu e-mail" required />
      <button type="submit">Enviar código</button>
    </form>
    <p><a href="/web/login">Voltar ao login</a></p>
  </div>
</body>
</html>`;
  res.send(html);
});

router.post('/esqueci-senha', passwordResetRateLimit, async (req, res) => {
  const { email } = req.body;
  if (!email || !isValidEmail(email)) {
    return res.status(400).send('E-mail inválido.');
  }

  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    return res.send('Se o e-mail estiver cadastrado, você receberá um código em instantes.');
  }

  const code = await generatePasswordResetCode(user.id);
  const sent = await sendPasswordResetCode(email, code);
  if (!sent) {
    return res.status(500).send('Erro ao enviar e-mail. Tente novamente mais tarde.');
  }

  res.send('Código enviado para seu e-mail. Verifique sua caixa de entrada.');
});

router.get('/redefinir-senha', (req, res) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Redefinir Senha</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f4f4; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
    .container { background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
    h2 { text-align: center; color: #333; }
    input { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
    button { width: 100%; padding: 10px; background: #6c5ce7; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Redefinir Senha</h2>
    <form method="POST" action="/web/redefinir-senha">
      <input type="email" name="email" placeholder="Seu e-mail" required />
      <input type="text" name="codigo" placeholder="Código de 6 dígitos" required />
      <input type="password" name="novaSenha" placeholder="Nova senha" required />
      <button type="submit">Redefinir</button>
    </form>
  </div>
</body>
</html>`;
  res.send(html);
});

router.post('/redefinir-senha', async (req, res) => {
  const { email, codigo, novaSenha } = req.body;
  if (!email || !codigo || !novaSenha) {
    return res.status(400).send('Preencha todos os campos.');
  }
  if (!isValidEmail(email)) {
    return res.status(400).send('E-mail inválido.');
  }

  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    return res.status(400).send('Usuário não encontrado.');
  }

  const valid = await validatePasswordResetCode(user.id, codigo);
  if (!valid) {
    return res.status(400).send('Código inválido ou expirado.');
  }

  if (novaSenha.length < 6) {
    return res.status(400).send('A senha deve ter no mínimo 6 caracteres.');
  }

  await resetPassword(user.id, novaSenha);

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Senha Redefinida</title></head>
<body style="font-family: Arial; text-align: center; margin-top: 100px;">
  <h2>✅ Senha redefinida com sucesso!</h2>
  <p>Você já pode usar sua nova senha em todos os serviços.</p>
</body>
</html>`;
  res.send(html);
});

// ==============================
// SAQUE BANCÁRIO (Web)
// ==============================

// Página de login
router.get('/saque', (req, res) => {
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Saque Bancário</title>
  <style>
    body { font-family: Arial; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f4f4f4; }
    .container { background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); width: 100%; max-width: 400px; }
    input { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
    button { width: 100%; padding: 10px; background: #6c5ce7; color: white; border: none; border-radius: 4px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Saque Bancário</h2>
    <form method="POST" action="/web/saque/login">
      <input type="text" name="telegramId" placeholder="Telegram ID" required />
      <input type="password" name="senha" placeholder="Senha" required />
      <button type="submit">Entrar</button>
    </form>
  </div>
</body>
</html>`;
  res.send(html);
});

// Processa login
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

  const token = jwt.sign({ userId: user.id }, config.web.secret, { expiresIn: '15m' });

  // Formulário de saque
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Saque Bancário - Dados</title>
  <style>
    body { font-family: Arial; background: #f4f4f4; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .container { background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.1); width: 100%; max-width: 500px; }
    input, select { width: 100%; padding: 10px; margin: 8px 0; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
    button { width: 100%; padding: 10px; background: #6c5ce7; color: white; border: none; border-radius: 4px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Saque Bancário</h2>
    <p>Saldo de comissão: R$ ${user.affiliateBalance}</p>
    <form method="POST" action="/web/saque/processar">
      <input type="hidden" name="token" value="${token}" />
      <label>Valor:</label>
      <input type="number" step="0.01" name="valor" required />
      <label>Banco:</label>
      <select name="banco" required>
        ${getBankOptions()}
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
  </div>
</body>
</html>`;
  res.send(html);
});

// Processa saque bancário
router.post('/saque/processar', async (req, res) => {
  const { token, valor, banco, agencia, conta, tipo, cpfCnpj, titular } = req.body;
  try {
    const decoded = jwt.verify(token, config.web.secret) as { userId: number };
    const userId = decoded.userId;
    const amount = parseFloat(valor);
    if (isNaN(amount) || amount <= 0) return res.status(400).send('Valor inválido');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).send('Usuário não encontrado');
    if (user.affiliateBalance < amount) return res.status(400).send('Saldo insuficiente');

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

    res.send('Solicitação de saque enviada com sucesso. Aguarde processamento.');
  } catch (error) {
    console.error('Erro no processamento de saque:', error);
    res.status(400).send('Erro ao processar saque');
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
  let html = '<h2>Histórico de Saques</h2><ul>';
  for (const w of withdrawals) {
    html += `<li>#${w.id} - R$ ${w.amount} - ${w.status} - ${w.createdAt.toLocaleDateString('pt-BR')}</li>`;
  }
  html += '</ul>';
  res.send(html);
});

// ==============================
// TERMOS (página configurável)
// ==============================

router.get('/termos', async (req, res) => {
  // Busca template de termos (se existir)
  const template = await prisma.messageTemplate.findUnique({ where: { key: 'termos' } });
  const texto = template?.text || 'Termos de uso não configurados.';
  res.send(`<div style="font-family: Arial; max-width: 800px; margin: auto; padding: 20px;">${texto.replace(/\n/g, '<br>')}</div>`);
});

// ==============================
// FUNÇÃO AUXILIAR: lista de bancos (exemplo com principais)
// ==============================

function getBankOptions(): string {
  const banks = [
    ['001', 'Banco do Brasil'],
    ['237', 'Bradesco'],
    ['341', 'Itaú'],
    ['104', 'Caixa Econômica Federal'],
    ['033', 'Santander'],
    ['260', 'Nubank'],
    ['290', 'PagBank'],
    ['212', 'Banco Original'],
    ['077', 'Banco Inter'],
    ['336', 'C6 Bank'],
    // ... adicionar mais de 500 conforme necessidade real
  ];
  return banks.map(b => `<option value="${b[0]}">${b[0]} - ${b[1]}</option>`).join('');
}

export default router;
