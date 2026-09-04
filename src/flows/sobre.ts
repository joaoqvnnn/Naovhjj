import { Context } from '../types/context';
import config from '../config';

export async function showSobre(ctx: Context) {
  const url = `${config.web.url}/web/sobre`;

  await ctx.editMessage('ℹ️ Sobre\n\nClique no botão abaixo para abrir as informações.', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📄 Abrir página', url }],
        [{ text: '⏮️ Voltar', callback_data: 'voltar_inicio' }],
      ],
    },
  });
}
