import { Context } from '../types/context';
import prisma from '../database';
import { startCapture } from '../middlewares/capture';
import { formatCurrency } from '../utils/format';
import { getPixConfig } from '../services/pixService';

export async function showRechargeMenu(ctx: Context) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });

  if (!user) return ctx.editMessageText('User not found.');

  const pixConfig = await getPixConfig();

  await ctx.editMessageText(
    `💰 Recharge Balance\n\n` +
    `Your balance: ${formatCurrency(user.balance)}\n` +
    `Minimum: ${formatCurrency(pixConfig.minAmount)}\n` +
    `Maximum: ${formatCurrency(pixConfig.maxAmount)}\n\n` +
    `Click below to generate a Pix.`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💠 Quick Pix', callback_data: 'pix_quick' }],
          [{ text: '⏮️ Back', callback_data: 'back_to_start' }],
        ],
      },
    }
  );
}

export async function startRechargeCapture(ctx: Context) {
  await startCapture(ctx, 'recharge_value', 'Enter the amount to recharge:', {
    validate: async (input) => {
      const num = parseFloat(input.replace(',', '.'));
      return isNaN(num) || num <= 0 ? 'Invalid value.' : null;
    },
    onSuccess: async (ctx, value) => {
      const amount = parseFloat(value.replace(',', '.'));
      const { startPixPayment } = await import('./pixPayment');
      await startPixPayment(ctx, amount);
    },
  });
}
