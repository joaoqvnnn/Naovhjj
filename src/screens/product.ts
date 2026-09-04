import { Context } from '../types/context';
import prisma from '../database';
import { formatCurrency } from '../utils/format';
import { replaceDynamicVars } from '../utils/dynamicVars';
import { getAvailableStock } from '../services/stock';

export async function showProduct(ctx: Context, productId: number) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { category: true },
  });

  if (!product || !product.isActive) {
    await ctx.editMessage('❌ Produto não encontrado ou desativado.', {
      reply_markup: { inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'voltar_categoria' }]] },
    });
    return;
  }

  const available = await getAvailableStock(productId);
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });

  // Busca template personalizado
  const template = await prisma.messageTemplate.findUnique({ where: { key: 'produto' } });
  let text: string;

  if (template) {
    // Usa template com variáveis dinâmicas
    text = replaceDynamicVars(template.text, {
      nome: product.name,
      emoji: product.emoji || '',
      preco: formatCurrency(product.price),
      saldo: formatCurrency(user?.balance || 0),
      estoque: available,
      descricao: product.description || '',
      garantia: product.guarantee || '',
      duracao: product.duration || '',
      vendidos: 0, // pode ser calculado
      visualizacoes: 0, // pode ser calculado
    });
  } else {
    // Template padrão
    text = `🔥 OPORTUNIDADE EXCLUSIVA 🔥\n` +
      `🚀 ${product.name}\n\n` +
      `🟢 DISPONÍVEL AGORA\n` +
      `├ 💵 Preço: ${formatCurrency(product.price)}\n` +
      `├ 💰 Seu Saldo: ${formatCurrency(user?.balance || 0)}\n` +
      `└ 📦 Estoque: ${available}\n\n` +
      `${product.description ? `📝 Descrição:\n${product.description}\n\n` : ''}` +
      `${product.guarantee ? `🛡 Garantia: ${product.guarantee}\n` : ''}` +
      `✅ Compra segura. Ao adquirir, concorda com /termos`;
  }

  const keyboard = {
    inline_keyboard: [
      [{ text: '💳 Comprar', callback_data: `comprar_${product.id}` }],
      [{ text: '🛒 Comprar mais de um', callback_data: `comprar_qtd_${product.id}` }],
      [{ text: '⏮️ Voltar', callback_data: 'voltar_categoria' }],
    ],
  };

  await ctx.editMessage(text, { reply_markup: keyboard });
}
