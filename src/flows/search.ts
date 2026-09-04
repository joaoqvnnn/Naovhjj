import { Context } from '../types/context';
import prisma from '../database';
import { startCapture } from '../middlewares/capture';
import { formatCurrency } from '../utils/format';

export async function searchService(ctx: Context) {
  await startCapture(ctx, 'search_service', 'Digite o nome do serviço:', {
    validate: async (input) => input.trim().length > 0 ? null : 'Digite algo.',
    onSuccess: async (ctx, term) => {
      const products = await prisma.product.findMany({
        where: {
          isActive: true,
          name: { contains: term, mode: 'insensitive' },
        },
        take: 10,
      });

      if (!products.length) {
        await ctx.editMessage('Nenhum serviço encontrado.');
        return;
      }

      const buttons = products.map(p => [{
        text: `${p.name} - ${formatCurrency(p.price)}`,
        callback_data: `search_select_${p.id}`,
      }]);
      buttons.push([{ text: '⏮️ Voltar', callback_data: 'voltar_inicio' }]);

      await ctx.editMessage('Resultados da pesquisa:', {
        reply_markup: { inline_keyboard: buttons },
      });
    },
  });
}
