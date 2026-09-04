import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { formatCurrency, formatDateTime } from '../utils/format';

// Mostra lista de saques por status
export async function showWithdrawalList(ctx: Context, status: string = 'PENDING') {
  if (!(await isAdmin(ctx))) return;

  const where = status === 'ALL' ? {} : { status };
  const withdrawals = await prisma.withdrawal.findMany({
    where,
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  if (!withdrawals.length) {
    await ctx.editMessage(`📭 Nenhum saque com status ${status}.`, {
      reply_markup: { inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'admin_saques' }]] },
    });
    return;
  }

  let text = `💸 SAQUES (${status})\n\n`;
  withdrawals.forEach((w, i) => {
    text += `#${w.id} | ${w.user.username || w.user.id} | ${formatCurrency(w.amount)} | ${w.status}\n`;
  });

  const buttons = withdrawals.map(w => [{ text: `🔍 #${w.id}`, callback_data: `saque_view_${w.id}` }]);
  buttons.push([{ text: '⏮️ Voltar', callback_data: 'admin_saques' }]);

  await ctx.editMessage(text, { reply_markup: { inline_keyboard: buttons } });
}

// Mostra menu principal de saques
export async function showWithdrawalMenu(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await ctx.editMessage('💸 GERENCIAR SAQUES\n\nSelecione:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '⏳ Pendentes', callback_data: 'saques_pending' }],
        [{ text: '🔄 Processando', callback_data: 'saques_processing' }],
        [{ text: '✅ Pagos', callback_data: 'saques_paid' }],
        [{ text: '❌ Rejeitados', callback_data: 'saques_rejected' }],
        [{ text: '📋 Todos', callback_data: 'saques_all' }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_dashboard' }],
      ],
    },
  });
}

// Visualiza detalhes de um saque específico
export async function viewWithdrawal(ctx: Context, withdrawalId: number) {
  if (!(await isAdmin(ctx))) return;
  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id: withdrawalId },
    include: { user: true },
  });
  if (!withdrawal) return ctx.editMessage('Saque não encontrado.');

  const text = `💸 Saque #${withdrawal.id}\n\n` +
    `👤 Usuário: ${withdrawal.user.username || withdrawal.user.id}\n` +
    `💰 Valor: ${formatCurrency(withdrawal.amount)}\n` +
    `💳 Taxa: ${formatCurrency(withdrawal.fee)}\n` +
    `💵 Líquido: ${formatCurrency(withdrawal.netAmount)}\n` +
    `📅 Data: ${formatDateTime(withdrawal.createdAt)}\n` +
    `🏦 Método: ${withdrawal.method}\n` +
    `💠 Pix: ${withdrawal.pixKey || 'N/A'}\n` +
    `🏦 Dados bancários: ${withdrawal.bankDetails ? JSON.stringify(withdrawal.bankDetails) : 'N/A'}\n` +
    `🔄 Status: ${withdrawal.status}`;

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '✅ Aprovar/Pagar', callback_data: `saque_aprovar_${withdrawal.id}` }],
        [{ text: '❌ Rejeitar', callback_data: `saque_rejeitar_${withdrawal.id}` }],
        [{ text: '🔄 Reprocessar', callback_data: `saque_reprocessar_${withdrawal.id}` }],
        [{ text: '⏮️ Voltar', callback_data: 'saques_pending' }],
      ],
    },
  });
}
