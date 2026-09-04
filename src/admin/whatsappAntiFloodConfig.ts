import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';

export async function showWhatsAppAntiFloodConfig(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const setting = await prisma.setting.findUnique({ where: { key: 'whatsapp_antiflood' } });
  const config = setting?.value as any || {
    max: 10,
    intervalSec: 30,
    blockSec: 300,
  };

  const text = `🛡️ Anti-Flood WhatsApp\n\n` +
    `Máx. mensagens: ${config.max}\n` +
    `Intervalo (seg): ${config.intervalSec}\n` +
    `Bloqueio (seg): ${config.blockSec}`;

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔢 Máx. mensagens', callback_data: 'wa_af_set_max' }],
        [{ text: '⏱️ Intervalo', callback_data: 'wa_af_set_interval' }],
        [{ text: '⏳ Bloqueio', callback_data: 'wa_af_set_block' }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_menu_actions' }],
      ],
    },
  });
}

export async function setWhatsAppAntiFloodParam(ctx: Context, param: string) {
  if (!(await isAdmin(ctx))) return;

  const paramMap: Record<string, { key: string; label: string }> = {
    max: { key: 'max', label: 'Digite o máximo de mensagens permitidas:' },
    interval: { key: 'intervalSec', label: 'Digite o intervalo em segundos:' },
    block: { key: 'blockSec', label: 'Digite a duração do bloqueio em segundos:' },
  };

  const p = paramMap[param];
  if (!p) return ctx.editMessage('Parâmetro inválido.');

  await startCapture(ctx, `wa_af_${param}`, p.label, {
    validate: async (input) => {
      const num = parseInt(input);
      return isNaN(num) || num < 1 ? 'Valor inválido.' : null;
    },
    onSuccess: async (ctx, value) => {
      const num = parseInt(value);
      const setting = await prisma.setting.findUnique({ where: { key: 'whatsapp_antiflood' } });
      const config = setting?.value as any || {};
      config[p.key] = num;
      await prisma.setting.upsert({
        where: { key: 'whatsapp_antiflood' },
        update: { value: config },
        create: { key: 'whatsapp_antiflood', value: config },
      });
      await ctx.editMessage('✅ Parâmetro atualizado.', {
        reply_markup: {
          inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'wa_af_menu' }]],
        },
      });
    },
  });
}
