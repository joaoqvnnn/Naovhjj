import { Context } from '../types/context';
import prisma from '../database';
import { logAction } from '../services/logger';

export async function showRentBot(ctx: Context) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });

  if (!user || user.role === 'USER') {
    await ctx.editMessage('Acesso negado.');
    return;
  }

  // Busca link de suporte para aluguel
  const setting = await prisma.setting.findUnique({ where: { key: 'rent_bot_link' } });
  const rentLink = setting?.value || 'https://t.me/larizinhastorebot';

  const text = `🤖 ALUGAR BOT\n\n` +
    `Você pode alugar este bot para ter sua própria loja digital.\n\n` +
    `Entre em contato para saber valores e condições:\n` +
    `${rentLink}\n\n` +
    `O aluguel inclui:\n` +
    `- Painel administrativo completo\n` +
    `- Sistema de pagamentos via Pix\n` +
    `- Estoque de produtos\n` +
    `- Afiliados e saques\n` +
    `- Suporte e atualizações`;

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💬 Negociar aluguel', url: rentLink }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_start' }],
      ],
    },
  });

  await logAction({ action: 'RENT_BOT_VIEWED', userId: user.id });
}
