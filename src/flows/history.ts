import { Context } from '../types/context';
import prisma from '../database';
import { formatCurrency } from '../utils/format';

export async function showHistory(ctx: Context, page: number = 0) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
  if (!user) return ctx.editMessageText('User not found.');

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
    await ctx.editMessageText('📭 You have no purchases.', {
      reply_markup: { inline_keyboard: [[{ text: '⏮️ Back', callback_data: 'menu_profile' }]] },
    });
    return;
  }

  const totalPages = Math.ceil(total / perPage) || 1;
  let text = `🛍 Purchase History (${page + 1}/${totalPages})\n\n`;

  orders.forEach((order) => {
    text += `📦 ${order.product.name}\n` +
      `💰 Amount: ${formatCurrency(order.totalPrice)}\n` +
      `📅 Date: ${order.createdAt.toLocaleDateString('pt-BR')}\n` +
      `🆔 ID: ${order.id}\n` +
      `📧 Email: ${order.email || 'N/A'}\n` +
      `📃 Status: ${order.status}\n\n`;
  });

  const buttons = [];
  const navButtons = [];
  if (page > 0) navButtons.push({ text: '⬅️ Previous', callback_data: `hist_page_${page - 1}` });
  if (page < totalPages - 1) navButtons.push({ text: 'Next ➡️', callback_data: `hist_page_${page + 1}` });
  if (navButtons.length) buttons.push(navButtons);

  buttons.push([{ text: '⏮️ Back', callback_data: 'menu_profile' }]);

  await ctx.editMessageText(text, { reply_markup: { inline_keyboard: buttons } });
}
