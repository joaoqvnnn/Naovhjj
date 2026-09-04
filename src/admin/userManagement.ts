import { Context } from '../types/context';
import prisma from '../database';
import { formatCurrency } from '../utils/format';
import { startCapture } from '../middlewares/capture';
import { logAction } from '../services/logger';

// Verifica se o usuário tem permissão administrativa
export async function isAdmin(ctx: Context): Promise<boolean> {
  const userId = ctx.from?.id;
  if (!userId) return false;
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(userId) },
  });
  return user?.role !== 'USER' && user?.role !== undefined;
}

// Pesquisa usuário por Telegram ID, username ou ID interno
export async function searchUser(ctx: Context, term: string) {
  const isAdminUser = await isAdmin(ctx);
  if (!isAdminUser) {
    await ctx.editMessage('⛔ Acesso negado.');
    return;
  }

  // Tenta interpretar como número (Telegram ID ou ID interno)
  let user = null;
  if (/^\d+$/.test(term)) {
    const idNum = parseInt(term);
    user = await prisma.user.findFirst({
      where: {
        OR: [
          { telegramId: BigInt(idNum) },
          { id: idNum },
        ],
      },
    });
  }

  if (!user) {
    user = await prisma.user.findFirst({
      where: {
        username: { contains: term, mode: 'insensitive' },
      },
    });
  }

  if (!user) {
    await ctx.editMessage(`❌ Nenhum usuário encontrado para "${term}".`);
    return;
  }

  const ordersCount = await prisma.order.count({ where: { userId: user.id } });
  const totalSpent = await prisma.order.aggregate({
    where: { userId: user.id, status: 'PAID' },
    _sum: { totalPrice: true },
  });

  const text = `👤 Usuário Encontrado\n\n` +
    `🆔 ID interno: ${user.id}\n` +
    `📱 Telegram ID: ${user.telegramId}\n` +
    `👤 Nome: ${user.firstName || 'N/A'} ${user.lastName || ''}\n` +
    `👤 Username: @${user.username || 'N/A'}\n` +
    `💰 Saldo: ${formatCurrency(user.balance)}\n` +
    `🤝 Saldo afiliado: ${formatCurrency(user.affiliateBalance)}\n` +
    `📊 Compras: ${ordersCount}\n` +
    `💵 Total gasto: ${formatCurrency(totalSpent._sum.totalPrice || 0)}\n` +
    `📅 Cadastro: ${user.createdAt.toLocaleDateString('pt-BR')}\n` +
    `🚦 Status: ${user.status}`;

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔒 Bloquear', callback_data: `admin_bloquear_${user.id}` }, { text: '🔓 Desbloquear', callback_data: `admin_desbloquear_${user.id}` }],
        [{ text: '💰 Ajustar Saldo', callback_data: `admin_ajustar_saldo_${user.id}` }],
        [{ text: '📜 Histórico de Compras', callback_data: `admin_hist_${user.id}` }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_usuarios' }],
      ],
    },
  });
}

// Bloqueia um usuário
export async function blockUser(ctx: Context, userId: number) {
  if (!(await isAdmin(ctx))) return;
  await prisma.user.update({
    where: { id: userId },
    data: { status: 'BLOCKED' },
  });
  await logAction({ action: 'USER_BLOCKED', userId, details: { by: ctx.from?.id } });
  await ctx.editMessage(`✅ Usuário #${userId} bloqueado com sucesso.`);
}

// Desbloqueia um usuário
export async function unblockUser(ctx: Context, userId: number) {
  if (!(await isAdmin(ctx))) return;
  await prisma.user.update({
    where: { id: userId },
    data: { status: 'ACTIVE' },
  });
  await logAction({ action: 'USER_UNBLOCKED', userId, details: { by: ctx.from?.id } });
  await ctx.editMessage(`✅ Usuário #${userId} desbloqueado com sucesso.`);
}

// Inicia captura para ajustar saldo
export async function startAdjustBalance(ctx: Context, userId: number) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'admin_ajuste_saldo', 'Digite o novo saldo (ex: 100.00) ou use +/- para ajuste relativo (ex: +50, -30):', {
    validate: async (input) => {
      if (!/^[+-]?\d+(\.\d{1,2})?$/.test(input)) {
        return '❌ Valor inválido. Use formato numérico.';
      }
      return null;
    },
    onSuccess: async (ctx, value) => {
      const numeric = parseFloat(value.replace(',', '.'));
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        await ctx.editMessage('Usuário não encontrado.');
        return;
      }

      if (value.startsWith('+')) {
        // Ajuste relativo positivo
        await prisma.user.update({
          where: { id: userId },
          data: { balance: { increment: numeric } },
        });
      } else if (value.startsWith('-')) {
        // Ajuste relativo negativo
        const abs = Math.abs(numeric);
        if (parseFloat(user.balance.toString()) < abs) {
          await ctx.editMessage('❌ Saldo insuficiente para decrementar.');
          return;
        }
        await prisma.user.update({
          where: { id: userId },
          data: { balance: { decrement: abs } },
        });
      } else {
        // Ajuste absoluto
        await prisma.user.update({
          where: { id: userId },
          data: { balance: numeric },
        });
      }

      await logAction({
        action: 'BALANCE_ADJUSTED',
        userId,
        details: { by: ctx.from?.id, value },
      });
      await ctx.editMessage(`✅ Saldo do usuário #${userId} atualizado.`);
    },
  });
}

// Mostra histórico de compras de um usuário específico
export async function showUserOrders(ctx: Context, userId: number) {
  if (!(await isAdmin(ctx))) return;
  const orders = await prisma.order.findMany({
    where: { userId },
    include: { product: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  if (!orders.length) {
    await ctx.editMessage('📭 Nenhuma compra para este usuário.');
    return;
  }

  const text = orders.map((o, i) => (
    `${i + 1}. ${o.product.name} - ${formatCurrency(o.totalPrice)} - ${o.status} - ${o.createdAt.toLocaleDateString('pt-BR')}`
  )).join('\n');

  await ctx.editMessage(`📜 Compras do usuário #${userId}:\n\n${text}`);
}
