import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { formatCurrency, formatDateTime } from '../utils/format';

export async function showWithdrawalMenu(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await ctx.editMessage('💸 Saques\n\nEscolha o status:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '⏳ Pendentes', callback_data: 'withdrawals_pending' }],
        [{ text: '✅ Pagos', callback_data: 'withdrawals_paid' }],
        [{ text: '❌ Rejeitados', callback_data: 'withdrawals_rejected' }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_menu_transactions' }],
      ],
    },
  });
}

export async function listWithdrawalsByStatus(ctx: Context, status: string) {
  if (!(await isAdmin(ctx))) return;

  const where = status === 'ALL' ? {} : { status };
  const withdrawals = await prisma.withdrawal.findMany({
    where,
    include: { user: { select: { username: true, telegramId: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  if (!withdrawals.length) {
    await ctx.editMessage(`Nenhum saque com status ${status}.`, {
      reply_markup: { inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'admin_transactions_withdrawals' }]] },
    });
    return;
  }

  let text = `💸 Saques (${status})\n\n`;
  withdrawals.forEach(w => {
    text += `#${w.id} | ${w.user.username || w.user.telegramId} | ${formatCurrency(w.amount)} | ${w.status}\n`;
  });

  const buttons = withdrawals.map(w => [{ text: `🔍 #${w.id}`, callback_data: `saque_view_${w.id}` }]);
  buttons.push([{ text: '⏮️ Voltar', callback_data: 'admin_transactions_withdrawals' }]);

  await ctx.editMessage(text, { reply_markup: { inline_keyboard: buttons } });
}

export async function viewWithdrawal(ctx: Context, withdrawalId: number) {
  if (!(await isAdmin(ctx))) return;

  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id: withdrawalId },
    include: { user: { select: { username: true, telegramId: true } } },
  });

  if (!withdrawal) return ctx.editMessage('Saque não encontrado.');

  const text = `💸 Saque #${withdrawal.id}\n\n` +
    `Usuário: ${withdrawal.user.username || withdrawal.user.telegramId}\n` +
    `Valor: ${formatCurrency(withdrawal.amount)}\n` +
    `Taxa: ${formatCurrency(withdrawal.fee)}\n` +
    `Líquido: ${formatCurrency(withdrawal.netAmount)}\n` +
    `Método: ${withdrawal.method}\n` +
    `Pix: ${withdrawal.pixKey || 'N/A'}\n` +
    `Status: ${withdrawal.status}\n` +
    `Data: ${formatDateTime(withdrawal.createdAt)}`;

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ Aprovar', callback_data: `saque_aprovar_${withdrawal.id}` }],
        [{ text: '❌ Rejeitar', callback_data: `saque_rejeitar_${withdrawal.id}` }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_transactions_withdrawals' }],
      ],
    },
  });
}

export async function approveWithdrawal(ctx: Context, withdrawalId: number) {
  if (!(await isAdmin(ctx))) return;

  const withdrawal = await prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
  if (!withdrawal) return ctx.editMessage('Saque não encontrado.');
  if (withdrawal.status === 'PAID') return ctx.editMessage('Saque já pago.');

  await prisma.withdrawal.update({ where: { id: withdrawalId }, data: { status: 'PAID', processedAt: new Date() } });
  await ctx.editMessage(`✅ Saque #${withdrawalId} aprovado.`);
  await viewWithdrawal(ctx, withdrawalId);
}

export async function rejectWithdrawal(ctx: Context, withdrawalId: number) {
  if (!(await isAdmin(ctx))) return;

  const withdrawal = await prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
  if (!withdrawal) return ctx.editMessage('Saque não encontrado.');

  await prisma.$transaction(async (tx) => {
    await tx.withdrawal.update({ where: { id: withdrawalId }, data: { status: 'REJECTED' } });
    await tx.user.update({ where: { id: withdrawal.userId }, data: { affiliateBalance: { increment: withdrawal.amount } } });
  });

  await ctx.editMessage(`❌ Saque #${withdrawalId} rejeitado. Saldo devolvido.`);
  await viewWithdrawal(ctx, withdrawalId);
}
