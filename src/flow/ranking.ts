import { Context } from '../types/context';
import prisma from '../database';
import { formatCurrency } from '../utils/format';
import { goToScreen } from '../screens/manager';

// Tela de rankings
export async function showRankingScreen(ctx: Context) {
  await ctx.editMessage(
    `🏆 RANKINGS\n\nSelecione o tipo de ranking:`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📦 Serviços mais vendidos', callback_data: 'rank_produtos' }],
          [{ text: '👥 Usuários que mais compraram', callback_data: 'rank_usuarios_compras' }],
          [{ text: '💰 Usuários que mais recarregaram', callback_data: 'rank_usuarios_recargas' }],
          [{ text: '💎 Maiores saldos', callback_data: 'rank_saldos' }],
          [{ text: '⏮️ Voltar', callback_data: 'voltar' }],
        ],
      },
    }
  );
}

// Ranking de produtos mais vendidos
export async function rankProducts(ctx: Context) {
  const result = await prisma.order.groupBy({
    by: ['productId'],
    where: { status: 'PAID' },
    _count: { productId: true },
    orderBy: { _count: { productId: 'desc' } },
    take: 10,
  });

  const productIds = result.map(r => r.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
  });
  const productMap = new Map(products.map(p => [p.id, p]));

  let text = `📦 SERVIÇOS MAIS VENDIDOS\n\n`;
  result.forEach((r, i) => {
    const product = productMap.get(r.productId);
    text += `${i + 1}º ${product?.name || 'Desconhecido'} - ${r._count.productId} vendas\n`;
  });

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'menu_ranking' }]],
    },
  });
}

// Ranking de usuários que mais compraram (por valor)
export async function rankUsersByPurchases(ctx: Context) {
  const result = await prisma.order.groupBy({
    by: ['userId'],
    where: { status: 'PAID' },
    _sum: { totalPrice: true },
    orderBy: { _sum: { totalPrice: 'desc' } },
    take: 10,
  });

  const userIds = result.map(r => r.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
  });
  const userMap = new Map(users.map(u => [u.id, u]));

  let text = `👥 USUÁRIOS QUE MAIS COMPRARAM\n\n`;
  result.forEach((r, i) => {
    const user = userMap.get(r.userId);
    const nome = user?.username || user?.firstName || 'Desconhecido';
    text += `${i + 1}º ${nome} - ${formatCurrency(r._sum.totalPrice || 0)}\n`;
  });

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'menu_ranking' }]],
    },
  });
}

// Ranking de usuários que mais recarregaram
export async function rankUsersByRecharge(ctx: Context) {
  const result = await prisma.recharge.groupBy({
    by: ['userId'],
    where: { status: 'APPROVED' },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: 10,
  });

  const userIds = result.map(r => r.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
  });
  const userMap = new Map(users.map(u => [u.id, u]));

  let text = `💰 USUÁRIOS QUE MAIS RECARREGARAM\n\n`;
  result.forEach((r, i) => {
    const user = userMap.get(r.userId);
    const nome = user?.username || user?.firstName || 'Desconhecido';
    text += `${i + 1}º ${nome} - ${formatCurrency(r._sum.amount || 0)}\n`;
  });

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'menu_ranking' }]],
    },
  });
}

// Ranking de maiores saldos
export async function rankByBalance(ctx: Context) {
  const users = await prisma.user.findMany({
    orderBy: { balance: 'desc' },
    take: 10,
  });

  let text = `💎 MAIORES SALDOS\n\n`;
  users.forEach((u, i) => {
    const nome = u.username || u.firstName || 'Desconhecido';
    text += `${i + 1}º ${nome} - ${formatCurrency(u.balance)}\n`;
  });

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'menu_ranking' }]],
    },
  });
}
