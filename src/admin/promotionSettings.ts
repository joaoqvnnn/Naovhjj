import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';

export async function showPromotionSettings(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const autoDeleteSetting = await prisma.setting.findUnique({ where: { key: 'promotion_auto_delete_ms' } });
  const viewerExpSetting = await prisma.setting.findUnique({ where: { key: 'viewer_expiration_ms' } });

  const autoDeleteMin = autoDeleteSetting ? parseInt(autoDeleteSetting.value.toString()) / 60000 : 20;
  const viewerMin = viewerExpSetting ? parseInt(viewerExpSetting.value.toString()) / 60000 : 5;

  const text = `📣 Promoções e Visualizações\n\n` +
    `Auto-delete de promoções: ${autoDeleteMin} minutos\n` +
    `Expiração de visualizações: ${viewerMin} minutos`;

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Auto-delete', callback_data: 'promo_set_autodelete' }],
        [{ text: 'Visualizações', callback_data: 'promo_set_viewers' }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_menu_actions' }],
      ],
    },
  });
}

export async function setAutoDelete(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  await startCapture(ctx, 'promo_autodelete', 'Digite o tempo em minutos para apagar promoções:', {
    validate: async (input) => {
      const num = parseInt(input);
      return isNaN(num) || num < 1 ? 'Valor inválido.' : null;
    },
    onSuccess: async (ctx, value) => {
      const minutes = parseInt(value);
      await prisma.setting.upsert({
        where: { key: 'promotion_auto_delete_ms' },
        update: { value: minutes * 60000 },
        create: { key: 'promotion_auto_delete_ms', value: minutes * 60000 },
      });
      await ctx.editMessage('✅ Auto-delete atualizado.', {
        reply_markup: {
          inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'promo_settings' }]],
        },
      });
    },
  });
}

export async function setViewerExpiration(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  await startCapture(ctx, 'viewer_expiration', 'Digite o tempo em minutos para expirar visualizações:', {
    validate: async (input) => {
      const num = parseInt(input);
      return isNaN(num) || num < 1 ? 'Valor inválido.' : null;
    },
    onSuccess: async (ctx, value) => {
      const minutes = parseInt(value);
      await prisma.setting.upsert({
        where: { key: 'viewer_expiration_ms' },
        update: { value: minutes * 60000 },
        create: { key: 'viewer_expiration_ms', value: minutes * 60000 },
      });
      await ctx.editMessage('✅ Expiração de visualizações atualizada.', {
        reply_markup: {
          inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'promo_settings' }]],
        },
      });
    },
  });
}
