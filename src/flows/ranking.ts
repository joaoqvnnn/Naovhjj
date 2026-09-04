import { Context } from '../types/context';
import prisma from '../database';
import { formatCurrency } from '../utils/format';

// Tipos de ranking
type RankingType = 'servicos' | 'recargas' | 'saldo' | 'compras';

// Função principal que renderiza a mensagem do ranking
export async function showRanking(ctx: Context, type: RankingType = 'servicos') {
  const buttons = [
    { text: `${type === 'servicos' ? '✅' : '☑️'} Serviços mais vendidos`, callback_data: 'rank_servicos' },
    { text: `${type === 'recargas' ? '✅' : '☑️'} Usuários que mais recarregaram`, callback_data: 'rank_recargas' },
    { text: `${type === 'saldo' ? '✅' : '☑️'} Maiores saldos`, callback_data: 'rank_saldo' },
    { text: `${type === 'compras' ? '✅' : '☑️'} Usuários que mais compraram`, callback_data: 'rank_compras' },
    { text: '⏮️ Voltar', callback_data: 'voltar_inicio' },
  ];

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

  // Edita a mensagem atual (ou envia nova se não houver mensagem para editar)
  if (ctx.session.messageIdToEdit && ctx.session.chatId) {
    await ctx.telegram.editMessageText(
      ctx.session.chatId,
      ctx.session.messageIdToEdit,
      undefined,
      text,
      { reply_markup: { inline_keyboard: buttons.map(b => [{ text: b.text, callback_data: b.callback_data }]) } }
    );
  } else {
    const sent = await ctx.reply(text, {
      reply_markup: { inline_keyboard: buttons.map(b => [{ text: b.text, callback_data: b.callback_data }]) },
    });
    if (sent.message_id) {
      ctx.session.messageIdToEdit = sent.message_id;
      ctx.session.chatId = ctx.chat!.id;
    }
  }
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

  let text = '🏆 Ranking dos serviços mais vendidos (deste mês)\n\n';
  result.forEach((r, i) => {
    const p = map.get(r.productId);
    text += `${i + 1}°) ${p?.name || 'Desconhecido'} ${i < 3 ? ['🥇', '🥈', '🥉'][i] : ''} - Com ${r._count.productId} pedidos\n`;
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

  let text = '🏆 Ranking dos usuários que mais recarregaram (deste mês)\n\n';
  result.forEach((r, i) => {
    const u = map.get(r.userId);
    const nome = u?.username || u?.firstName || 'Desconhecido';
    text += `${i + 1}°) ${nome} ${i < 3 ? ['🥇', '🥈', '🥉'][i] : ''} - R$ ${(r._sum.amount || 0).toFixed(2)}\n`;
  });
  return text;
}

async function getTopBalances(): Promise<string> {
  const users = await prisma.user.findMany({
    orderBy: { balance: 'desc' },
    take: 10,
  });
  let text = '🏆 Ranking dos usuários com mais saldo no bot\n\n';
  users.forEach((u, i) => {
    const nome = u.username || u.firstName || 'Desconhecido';
    text += `${i + 1}°) ${nome} ${i < 3 ? ['🥇', '🥈', '🥉'][i] : ''} - ${formatCurrency(u.balance)}\n`;
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

  let text = '🏆 Ranking dos usuários que mais compraram (deste mês)\n\n';
  result.forEach((r, i) => {
    const u = map.get(r.userId);
    const nome = u?.username || u?.firstName || 'Desconhecido';
    text += `${i + 1}°) ${nome} ${i < 3 ? ['🥇', '🥈', '🥉'][i] : ''} - ${formatCurrency(r._sum.totalPrice || 0)}\n`;
  });
  return text;
}
