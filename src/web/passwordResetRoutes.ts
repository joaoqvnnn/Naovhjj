import { Router, Request, Response } from 'express';
import prisma from '../database';
import { generatePasswordResetCode, validatePasswordResetCode, resetPassword } from '../services/passwordReset';
import { sendPasswordResetCode } from '../services/email';
import { isValidEmail } from '../utils/format';
import { passwordResetRateLimit } from '../middlewares/passwordResetRateLimit';

const router = Router();

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
    .msg { color: red; text-align: center; }
    .success { color: green; text-align: center; }
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
    input[type="email"], input[type="text"], input[type="password"] { width: 100%; padding: 10px; margin: 10px 0; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
    button { width: 100%; padding: 10px; background: #6c5ce7; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
    button:hover { background: #5a4bd1; }
    .msg { color: red; text-align: center; }
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
<head>
  <meta charset="UTF-8">
  <title>Senha Redefinida</title>
  <style>
    body { font-family: Arial; display: flex; justify-content: center; align-items: center; height: 100vh; }
    .container { text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <h2>✅ Senha redefinida com sucesso!</h2>
    <p>Você já pode usar sua nova senha em todos os serviços.</p>
  </div>
</body>
</html>`;
  res.send(html);
});

export default router;
