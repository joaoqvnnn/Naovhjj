import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { formatCurrency, formatDateTime } from '../utils/format';

export async function showManualPixPending(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const pending = await prisma.payment.findMany({
    where: { method: 'PIX', status: 'PENDING' },
    include: { user: { select: { username: true, telegramId: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  if (!pending.length) {
    await ctx.editMessage('Nenhum pagamento manual pendente.', {
      reply_markup: { inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'admin_menu_transactions' }]] },
    });
    return;
  }

  let text = '💠 Pix Manuais Pendentes\n\n';
  pending.forEach(p => {
    text += `#${p.id} | ${p.user.username || p.user.telegramId} | ${formatCurrency(p.amount)} | ${formatDateTime(p.createdAt)}\n`;
  });

  const buttons = pending.map(p => [{ text: `🔍 #${p.id}`, callback_data: `pixmanual_view_${p.id}` }]);
  buttons.push([{ text: '⏮️ Voltar', callback_data: 'admin_menu_transactions' }]);

  await ctx.editMessage(text, { reply_markup: { inline_keyboard: buttons } });
}

export async function viewManualPix(ctx: Context, paymentId: number) {
  if (!(await isAdmin(ctx))) return;

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { user: { select: { username: true, telegramId: true } } },
  });

  if (!payment) return ctx.editMessage('Pagamento não encontrado.');

  const text = `💳 Pagamento #${payment.id}\n\n` +
    `Usuário: ${payment.user.username || payment.user.telegramId}\n` +
    `Valor: ${formatCurrency(payment.amount)}\n` +
    `Data: ${formatDateTime(payment.createdAt)}\n` +
    `Código Pix: ${payment.qrCode || 'N/A'}\n` +
    `Status: ${payment.status}`;

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ Confirmar', callback_data: `pixmanual_confirm_${payment.id}` }],
        [{ text: '❌ Rejeitar', callback_data: `pixmanual_reject_${payment.id}` }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_transactions_pix_manual' }],
      ],
    },
  });
}

export async function confirmManualPixAction(ctx: Context, paymentId: number) {
  if (!(await isAdmin(ctx))) return;

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status === 'APPROVED') return ctx.editMessage('Pagamento já processado.');

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: paymentId }, data: { status: 'APPROVED', paidAt: new Date() } });
    await tx.user.update({ where: { id: payment.userId }, data: { balance: { increment: payment.amount } } });
    await tx.recharge.create({ data: { userId: payment.userId, amount: payment.amount, paymentId: payment.id, status: 'APPROVED' } });
  });

  await ctx.editMessage('✅ Pagamento confirmado e saldo creditado.');
}

export async function rejectManualPixAction(ctx: Context, paymentId: number) {
  if (!(await isAdmin(ctx))) return;
  await prisma.payment.update({ where: { id: paymentId }, data: { status: 'CANCELLED' } });
  await ctx.editMessage('❌ Pagamento rejeitado.');
}
