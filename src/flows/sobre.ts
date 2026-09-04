import { Context } from '../types/context';
import prisma from '../database';
import config from '../config';

export async function showSobre(ctx: Context) {
  const url = `${config.web.url}/web/sobre`;

  await ctx.editMessageText(
    `ℹ️ <b>Sobre</b>\n\n` +
    `Clique no botão abaixo para abrir a página com informações.`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📄 Abrir página', url }],
          [{ text: '⏮️ Voltar', callback_data: 'voltar_inicio' }],
        ],
      },
    }
  );
}
