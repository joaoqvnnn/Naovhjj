import { Context } from '../types/context';
import prisma from '../database';
import { formatCurrency } from '../utils/format';

// Handler para inline query
export async function handleInlineQuery(ctx: Context) {
  const query = ctx.inlineQuery?.query?.trim() || '';
  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      name: { contains: query, mode: 'insensitive' },
    },
    take: 10,
  });

  const results = products.map(p => ({
    type: 'article' as const,
    id: String(p.id),
    title: p.name,
    description: `R$ ${p.price} - Estoque: ${p.stockUnits.length}`,
    input_message_content: {
      message_text: `🎯 ${p.name}\n💲 Valor: ${formatCurrency(p.price)}\n📝 ${p.description || ''}\n\nPara comprar, clique no botão abaixo.`,
    },
    reply_markup: {
      inline_keyboard: [
        [{ text: '💳 Comprar', callback_data: `comprar_${p.id}` }],
        [{ text: '🔍 Ver detalhes', callback_data: `ver_produto_${p.id}` }],
      ],
    },
  }));

  await ctx.answerInlineQuery(results);
}
