import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { formatCurrency, formatDateTime } from '../utils/format';
import { confirmManualPix } from '../services/pixService';
import { logAction } from '../services/logger';

// Mostra pagamentos manuais pendentes
export async function showManualPixPending(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const pending = await prisma.payment.findMany({
    where: { method: 'PIX', status: 'PENDING' },
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  if (!pending.length) {
    await ctx.editMessage('📭 Nenhum pagamento manual pendente.', {
      reply_markup: { inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'admin_config' }]] },
    });
    return;
  }

  let text = '💳 PAGAMENTOS MANUAIS PENDENTES\n\n';
  pending.forEach((p, i) => {
    text += `#${p.id} | ${p.user.username || p.user.id} | ${formatCurrency(p.amount)} | ${formatDateTime(p.createdAt)}\n`;
  });

  const buttons = pending.map(p => [{ text: `🔍 #${p.id}`, callback_data: `pixmanual_view_${p.id}` }]);
  buttons.push([{ text: '⏮️ Voltar', callback_data: 'admin_config' }]);

  await ctx.editMessage(text, { reply_markup: { inline_keyboard: buttons } });
}

// Visualiza detalhes e permite confirmar/rejeitar
export async function viewManualPix(ctx: Context, paymentId: number) {
  if (!(await isAdmin(ctx))) return;

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { user: true },
  });

  if (!payment) return ctx.editMessage('Pagamento não encontrado.');

  const text = `💳 Pagamento #${payment.id}\n\n` +
    `👤 Usuário: ${payment.user.username || payment.user.id}\n` +
    `💰 Valor: ${formatCurrency(payment.amount)}\n` +
    `📅 Data: ${formatDateTime(payment.createdAt)}\n` +
    `💎 Código Pix: ${payment.qrCode || 'N/A'}\n` +
    `Status: ${payment.status}`;

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ Confirmar pagamento', callback_data: `pixmanual_confirm_${payment.id}` }],
        [{ text: '❌ Rejeitar', callback_data: `pixmanual_reject_${payment.id}` }],
        [{ text: '⏮️ Voltar', callback_data: 'pixmanual_pending' }],
      ],
    },
  });
}

// Confirma pagamento manual
export async function confirmManualPixAction(ctx: Context, paymentId: number) {
  if (!(await isAdmin(ctx))) return;
  const success = await confirmManualPix(paymentId);
  if (success) {
    await ctx.editMessage('✅ Pagamento confirmado e saldo creditado.');
    await logAction({ action: 'MANUAL_PIX_CONFIRMED', details: { paymentId, by: ctx.from?.id } });
  } else {
    await ctx.editMessage('❌ Não foi possível confirmar (já pago ou inexistente).');
  }
}

// Rejeita pagamento manual (apenas marca como cancelado)
export async function rejectManualPixAction(ctx: Context, paymentId: number) {
  if (!(await isAdmin(ctx))) return;
  await prisma.payment.update({
    where: { id: paymentId },
    data: { status: 'CANCELLED' },
  });
  await ctx.editMessage('❌ Pagamento rejeitado.');
  await logAction({ action: 'MANUAL_PIX_REJECTED', details: { paymentId, by: ctx.from?.id } });
}
