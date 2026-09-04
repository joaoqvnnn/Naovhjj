import { Router, Request, Response } from 'express';
import prisma from '../database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import config from '../config';
import { renderPage } from './layout';
import { deviceSecurityMiddleware } from '../middlewares/deviceSecurity';
import { logAction } from '../services/logger';
import { getFullBankOptionsHtml } from '../data/banksComplete';

const router = Router();

// Middleware para extrair e validar token JWT
function authMiddleware(req: Request, res: Response, next: Function) {
  const token = req.cookies?.auth_token || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.redirect('/web/auth/login');
  try {
    const decoded = jwt.verify(token, config.web.secret) as { userId: number };
    (req as any).userId = decoded.userId;
    next();
  } catch {
    return res.redirect('/web/auth/login');
  }
}

// Página de saque (protegida)
router.get('/saque', authMiddleware, deviceSecurityMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) return res.redirect('/web/auth/login');

  const content = `
    <h2>Saque Bancário</h2>
    <p>Saldo de comissão: <strong>R$ ${user.affiliateBalance}</strong></p>
    <form method="POST" action="/web/saque/processar">
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

// Processa saque bancário
router.post('/saque/processar', authMiddleware, deviceSecurityMiddleware, async (req, res) => {
  const userId = (req as any).userId;
  const { valor, banco, agencia, conta, tipo, cpfCnpj, titular } = req.body;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return res.status(404).send('Usuário não encontrado');

  const amount = parseFloat(valor);
  if (isNaN(amount) || amount <= 0) return res.status(400).send('Valor inválido');
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

  await logAction({ action: 'WITHDRAWAL_REQUESTED', userId, details: { amount } });

  res.send(renderPage('Saque Solicitado', '<p class="success">Solicitação enviada com sucesso.</p>', false));
});

// Histórico de saques (protegido)
router.get('/saque/historico', authMiddleware, deviceSecurityMiddleware, async (req, res) => {
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

// Termos
router.get('/termos', async (req, res) => {
  const template = await prisma.messageTemplate.findUnique({ where: { key: 'termos' } });
  const texto = template?.text || 'Termos de uso não configurados.';
  const content = `<div style="white-space: pre-wrap;">${texto.replace(/\n/g, '<br>')}</div>`;
  res.send(renderPage('Termos de Uso', content));
});

export default router;
