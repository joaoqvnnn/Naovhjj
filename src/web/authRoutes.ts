import { Router, Request, Response } from 'express';
import prisma from '../database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config';
import { renderPage } from './layout';
import { generateTwoFactorCode, validateTwoFactorCode } from '../services/twoFactor';
import { deviceSecurityMiddleware } from '../middlewares/deviceSecurity';
import { logAction } from '../services/logger';

const router = Router();

// Página de login
router.get('/login', (req, res) => {
  const content = `
    <h2>Login Seguro</h2>
    <form method="POST" action="/web/auth/login">
      <label>Telegram ID</label>
      <input type="text" name="telegramId" required />
      <label>Senha</label>
      <input type="password" name="senha" required />
      <button type="submit">Entrar</button>
    </form>
    <p><a href="/web/auth/esqueci-senha">Esqueci a senha</a></p>
  `;
  res.send(renderPage('Login', content));
});

// Processa login
router.post('/login', async (req, res) => {
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

  // Verifica se 2FA está ativado
  const twoFactorSetting = await prisma.setting.findUnique({ where: { key: 'two_factor_enabled' } });
  const twoFactorEnabled = twoFactorSetting?.value || false;

  if (twoFactorEnabled) {
    // Gera código 2FA e envia por e-mail
    const sent = await generateTwoFactorCode(user.id);
    if (!sent) {
      return res.status(500).send(renderPage('Erro', '<p class="error">Erro ao enviar código de verificação</p>'));
    }
    // Cria token temporário para validar 2FA
    const tempToken = jwt.sign({ userId: user.id, need2FA: true }, config.web.secret, { expiresIn: '5m' });
    return res.redirect(`/web/auth/2fa?token=${tempToken}`);
  }

  // Sem 2FA: gera token JWT final e aplica middleware de dispositivo
  const token = jwt.sign({ userId: user.id }, config.web.secret, { expiresIn: '15m' });
  res.cookie('auth_token', token, { httpOnly: true });
  (req as any).userId = user.id; // para o middleware
  return res.redirect('/web/saque');
});

// Página 2FA
router.get('/2fa', (req, res) => {
  const token = req.query.token as string;
  const content = `
    <h2>Verificação em Duas Etapas</h2>
    <p>Digite o código enviado para seu e-mail.</p>
    <form method="POST" action="/web/auth/2fa">
      <input type="hidden" name="token" value="${token}" />
      <input type="text" name="codigo" required />
      <button type="submit">Verificar</button>
    </form>
  `;
  res.send(renderPage('2FA', content));
});

// Processa 2FA
router.post('/2fa', async (req, res) => {
  const { token, codigo } = req.body;
  try {
    const decoded = jwt.verify(token, config.web.secret) as { userId: number; need2FA: boolean };
    if (!decoded.need2FA) return res.status(400).send('Token inválido.');

    const valid = await validateTwoFactorCode(decoded.userId, codigo);
    if (!valid) {
      return res.status(400).send(renderPage('Erro', '<p class="error">Código inválido ou expirado</p>'));
    }

    // 2FA válido: emite token final
    const finalToken = jwt.sign({ userId: decoded.userId }, config.web.secret, { expiresIn: '15m' });
    res.cookie('auth_token', finalToken, { httpOnly: true });
    return res.redirect('/web/saque');
  } catch {
    return res.status(400).send('Token inválido.');
  }
});

// Página esqueci senha
router.get('/esqueci-senha', (req, res) => {
  const content = `
    <h2>Recuperar Senha</h2>
    <p>Informe seu e-mail cadastrado para receber um código.</p>
    <form method="POST" action="/web/auth/esqueci-senha">
      <input type="email" name="email" required />
      <button type="submit">Enviar código</button>
    </form>
  `;
  res.send(renderPage('Recuperar Senha', content));
});

// Processa esqueci senha
router.post('/esqueci-senha', async (req, res) => {
  const { email } = req.body;
  const user = await prisma.user.findFirst({ where: { email } });
  if (!user) {
    return res.send(renderPage('Recuperar Senha', '<p class="success">Se o e-mail estiver cadastrado, você receberá um código.</p>'));
  }

  // Gera código de recuperação (reutiliza serviço de passwordReset, mas aqui simplificamos)
  const { generatePasswordResetCode } = await import('../services/passwordReset');
  const code = await generatePasswordResetCode(user.id);
  const { sendPasswordResetCode } = await import('../services/email');
  await sendPasswordResetCode(email, code);

  return res.send(renderPage('Recuperar Senha', '<p class="success">Código enviado.</p>'));
});

// Logout
router.get('/logout', (req, res) => {
  res.clearCookie('auth_token');
  res.redirect('/web/auth/login');
});

export default router;
