import { Context } from '../types/context';
import prisma from '../database';

export async function showAtendimentoDireto(ctx: Context) {
  const supportLink = await prisma.setting.findUnique({ where: { key: 'support_link' } });
  const link = supportLink?.value || 'https://t.me/larizinhastorebot';

  const text = `👤 Atendimento\n\n` +
    `Para falar com um atendente, clique no botão abaixo.\n` +
    `Você será direcionado ao nosso chat privado.`;

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💬 Abrir atendimento', url: link }],
        [{ text: '⏮️ Voltar', callback_data: 'voltar_inicio' }],
      ],
    },
  });
}
