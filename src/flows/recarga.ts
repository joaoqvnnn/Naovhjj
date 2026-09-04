import { Context } from '../types/context';
import prisma from '../database';
import { startCapture } from '../middlewares/capture';
import { formatCurrency } from '../utils/format';
import { getPixConfig } from '../services/pixService';

export async function showRecargaMenu(ctx: Context) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });

  if (!user) return ctx.editMessageText('Usuário não encontrado.');

  const pixConfig = await getPixConfig();

  await ctx.editMessageText(
    `💰 Recarregar Saldo\n\n` +
    `Seu saldo: ${formatCurrency(user.balance)}\n` +
    `Mínimo: ${formatCurrency(pixConfig.minAmount)}\n` +
    `Máximo: ${formatCurrency(pixConfig.maxAmount)}\n\n` +
    `Clique abaixo para gerar um Pix.`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💠 Pix Rápido', callback_data: 'pix_rapido' }],
          [{ text: '⏮️ Voltar', callback_data: 'voltar_inicio' }],
        ],
      },
    }
  );
}

export async function startRecargaCapture(ctx: Context) {
  await startCapture(ctx, 'valor_recarga', 'Digite o valor para recarregar:', {
    validate: async (input) => {
      const num = parseFloat(input.replace(',', '.'));
      return isNaN(num) || num <= 0 ? 'Valor inválido.' : null;
    },
    onSuccess: async (ctx, value) => {
      const amount = parseFloat(value.replace(',', '.'));
      const { startPixPayment } = await import('./pixPayment');
      await startPixPayment(ctx, amount);
    },
  });
}
