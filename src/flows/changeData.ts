import { Context } from '../types/context';
import prisma from '../database';
import { startCapture } from '../middlewares/capture';
import { normalizePhone } from '../utils/phoneValidation';

export async function showChangeData(ctx: Context) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });

  if (!user) return ctx.editMessageText('User not found.');

  await ctx.editMessageText(
    `✏️ Change Data\n\n` +
    `📱 WhatsApp: ${user.whatsapp || 'Not informed'}\n\n` +
    `Select data to change:`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📱 WhatsApp', callback_data: 'change_whatsapp' }],
          [{ text: '⏮️ Back', callback_data: 'menu_profile' }],
        ],
      },
    }
  );
}

export async function startChangeWhatsApp(ctx: Context) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });

  if (!user) return;

  await startCapture(ctx, 'change_whatsapp', 'Enter new WhatsApp number (with DDD):', {
    validate: async (input) => normalizePhone(input) ? null : 'Invalid number.',
    onSuccess: async (ctx, phone) => {
      const normalized = normalizePhone(phone)!;
      await prisma.user.update({ where: { id: user.id }, data: { whatsapp: normalized } });
      await ctx.editMessageText(`✅ WhatsApp updated to: ${normalized}`, {
        reply_markup: { inline_keyboard: [[{ text: '⏮️ Back', callback_data: 'menu_profile' }]] },
      });
    },
  });
}
