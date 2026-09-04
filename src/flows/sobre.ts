import { Context } from '../types/context';
import prisma from '../database';

export async function showSobre(ctx: Context) {
  const supportLink = await prisma.setting.findUnique({ where: { key: 'support_link' } });
  const versionSetting = await prisma.setting.findUnique({ where: { key: 'bot_version' } });
  const storeName = await prisma.setting.findUnique({ where: { key: 'store_name' } });

  const link = supportLink?.value || 'https://t.me/larizinhastorebot';
  const version = versionSetting?.value || '4.1.0';
  const nomeLoja = storeName?.value || 'Larizinha Store';

  const text = `🤖 ${nomeLoja}\n\n` +
    `Versão: ${version}\n` +
    `Sistema de loja digital no Telegram.\n\n` +
    `Para suporte, clique no botão abaixo ou acesse:\n${link}`;

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🆘 Suporte', url: link }],
        [{ text: '⏮️ Voltar', callback_data: 'voltar_inicio' }],
      ],
    },
  });
}
