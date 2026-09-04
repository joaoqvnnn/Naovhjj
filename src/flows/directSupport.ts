import { Context } from '../types/context';
import prisma from '../database';

export async function showDirectSupport(ctx: Context) {
  const supportLink = await prisma.setting.findUnique({ where: { key: 'support_link' } });
  const link = supportLink?.value || 'https://t.me/larizinhastorebot';

  await ctx.editMessageText(
    `👤 Direct Support\n\n` +
    `Click below to talk to an attendant.`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💬 Open support', url: link }],
          [{ text: '⏮️ Back', callback_data: 'back_to_start' }],
        ],
      },
    }
  );
}
