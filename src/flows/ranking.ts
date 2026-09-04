import { Context } from '../types/context';
import prisma from '../database';
import { formatCurrency } from '../utils/format';

type RankingType = 'servicos' | 'recargas' | 'saldo' | 'compras';

export async function showRanking(ctx: Context, type: RankingType = 'servicos') {
  let text = '';

  switch (type) {
    case 'servicos':
      text = await getTopProducts();
      break;
    case 'recargas':
      text = await getTopRecharges();
      break;
    case 'saldo':
      text = await getTopBalances();
      break;
    case 'compras':
      text = await getTopBuyers();
      break;
  }

  await ctx.editMessageText(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📦 Serviços', callback_data: 'rank_servicos' }],
        [{ text: '💰 Recargas', callback_data: 'rank_recargas' }],
        [{ text: '💎 Saldo', callback_data: 'rank_saldo' }],
        [{ text: '🛒 Compras', callback_data: 'rank_compras' }],
        [{ text: '⏮️ Voltar', callback_data: 'voltar_inicio' }],
      ],
    },
  });
}

async function getTopProducts(): Promise<string> {
  const result = await prisma.order.groupBy({
    by: ['productId'],
    where: { status: 'PAID' },
    _count: { productId: true },
    orderBy: { _count: { productId: 'desc' } },
    take: 10,
  });

  const productIds = result.map(r => r.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const map = new Map(products.map(p => [p.id, p]));

  let text = '🏆 Serviços Mais Vendidos (mês)\n\n';
  result.forEach((r, i) => {
    const p = map.get(r.productId);
    text += `${i + 1}°) ${p?.name || 'Desconhecido'} ${i < 3 ? ['🥇','🥈','🥉'][i] : ''} - ${r._count.productId} pedidos\n`;
  });
  return text;
}

async function getTopRecharges(): Promise<string> {
  const result = await prisma.recharge.groupBy({
    by: ['userId'],
    where: { status: 'APPROVED' },
    _sum: { amount: true },
    orderBy: { _sum: { amount: 'desc' } },
    take: 10,
  });

  const userIds = result.map(r => r.userId);
  const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
  const map = new Map(users.map(u => [u.id, u]));

  let text = '🏆 Usuários que Mais Recarregaram (mês)\n\n';
  result.forEach((r, i) => {
    const u = map.get(r.userId);
    text += `${i + 1}°) ${u?.username || 'Desconhecido'} ${i < 3 ? ['🥇','🥈','🥉'][i] : ''} - ${formatCurrency(r._sum.amount || 0)}\n`;
  });
  return text;
}

async function getTopBalances(): Promise<string> {
  const users = await prisma.user.findMany({
    orderBy: { balance: 'desc' },
    take: 10,
  });

  let text = '🏆 Maiores Saldos\n\n';
  users.forEach((u, i) => {
    text += `${i + 1}°) ${u.username || 'Desconhecido'} ${i < 3 ? ['🥇','🥈','🥉'][i] : ''} - ${formatCurrency(u.balance)}\n`;
  });
  return text;
}

async function getTopBuyers(): Promise<string> {
  const result = await prisma.order.groupBy({
    by: ['userId'],
    where: { status: 'PAID' },
    _sum: { totalPrice: true },
    orderBy: { _sum: { totalPrice: 'desc' } },
    take: 10,
  });

  const userIds = result.map(r => r.userId);
  const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
  const map = new Map(users.map(u => [u.id, u]));

  let text = '🏆 Usuários que Mais Compraram (mês)\n\n';
  result.forEach((r, i) => {
    const u = map.get(r.userId);
    text += `${i + 1}°) ${u?.username || 'Desconhecido'} ${i < 3 ? ['🥇','🥈','🥉'][i] : ''} - ${formatCurrency(r._sum.totalPrice || 0)}\n`;
  });
  return text;
}
