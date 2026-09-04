import { Context } from '../types/context';
import prisma from '../database';
import { formatCurrency } from '../utils/format';

export async function showHistorico(ctx: Context, page: number = 0) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
  if (!user) return ctx.editMessageText('Usuário não encontrado.');

  const perPage = 5;
  const total = await prisma.order.count({ where: { userId: user.id } });
  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    include: { product: true },
    orderBy: { createdAt: 'desc' },
    skip: page * perPage,
    take: perPage,
  });

  if (!orders.length) {
    await ctx.editMessageText('📭 Você não tem compras.', {
      reply_markup: { inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'menu_perfil' }]] },
    });
    return;
  }

  const totalPages = Math.ceil(total / perPage) || 1;
  let text = `🛍 Histórico de Compras (${page + 1}/${totalPages})\n\n`;

  orders.forEach((order, i) => {
    text += `📦 ${order.product.name}\n` +
      `💰 Valor: ${formatCurrency(order.totalPrice)}\n` +
      `📅 Data: ${order.createdAt.toLocaleDateString('pt-BR')}\n` +
      `🆔 ID: ${order.id}\n` +
      `📧 Email: ${order.email || 'N/A'}\n` +
      `🔐 Senha: ${order.stockUnits.length ? 'Disponível' : 'N/A'}\n` +
      `📃 Status: ${order.status}\n\n`;
  });

  const buttons = [];
  const navButtons = [];
  if (page > 0) navButtons.push({ text: '⬅️ Anterior', callback_data: `hist_page_${page - 1}` });
  if (page < totalPages - 1) navButtons.push({ text: 'Próxima ➡️', callback_data: `hist_page_${page + 1}` });
  if (navButtons.length) buttons.push(navButtons);

  buttons.push([{ text: '⏮️ Voltar', callback_data: 'menu_perfil' }]);

  await ctx.editMessageText(text, { reply_markup: { inline_keyboard: buttons } });
}
