import { Context } from '../types/context';
import prisma from '../database';
import { formatCurrency } from '../utils/format';
import { replaceVars } from '../flows/dynamicVars';
import { getAvailableStock } from '../services/stock';
import { getCurrentViewers, trackProductView } from '../services/viewers';

export async function showProduct(ctx: Context, productId: number) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { category: true },
  });

  if (!product || !product.isActive) {
    await ctx.editMessageText('❌ Produto não encontrado ou desativado.', {
      reply_markup: { inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'voltar_inicio' }]] },
    });
    return;
  }

  const available = await getAvailableStock(productId);
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });

  trackProductView(productId, user?.id || userId);
  const currentViewers = await getCurrentViewers(productId);

  const template = await prisma.messageTemplate.findUnique({ where: { key: 'produto' } });

  let text = '';
  if (template) {
    text = replaceVars(template.text, {
      nome: product.name,
      emoji: product.emoji || '',
      preco: formatCurrency(product.price),
      saldo: formatCurrency(user?.balance || 0),
      estoque: available,
      descricao: product.description || '',
      garantia: product.guarantee || '',
      duracao: product.duration || '',
      visualizacoes: currentViewers,
    });
  } else {
    text = `🔥 ${product.name}\n\n` +
      `🟢 Disponível\n` +
      `├ 💵 Preço: ${formatCurrency(product.price)}\n` +
      `├ 💰 Seu Saldo: ${formatCurrency(user?.balance || 0)}\n` +
      `└ 📦 Estoque: ${available}\n\n` +
      `${product.description ? `📝 ${product.description}\n\n` : ''}` +
      `${product.guarantee ? `🛡 Garantia: ${product.guarantee}\n` : ''}` +
      `👀 ${currentViewers} pessoas vendo isso agora.`;
  }

  const keyboard = {
    inline_keyboard: [
      [{ text: '💳 Comprar', callback_data: `comprar_${product.id}` }],
      [{ text: '🛒 Comprar mais de um', callback_data: `comprar_qtd_${product.id}` }],
      [{ text: '⏮️ Voltar', callback_data: 'voltar_inicio' }],
    ],
  };

  const imageUrl = template?.imageUrl || product.imageUrl;

  if (imageUrl) {
    await ctx.replyWithPhoto(imageUrl, {
      caption: text,
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } else {
    await ctx.editMessageText(text, { reply_markup: keyboard });
  }
}
