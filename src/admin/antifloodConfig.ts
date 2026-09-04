import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';

export async function showAntifloodConfig(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const setting = await prisma.setting.findUnique({ where: { key: 'antiflood' } });
  const config = setting?.value as any || {
    maxMessages: 10,
    intervalSeconds: 10,
    blockDurationSeconds: 60,
    maxBlocksBeforePermanent: 3,
  };

  const text = `🛡️ Anti-Flood\n\n` +
    `Máximo de mensagens: ${config.maxMessages}\n` +
    `Intervalo (segundos): ${config.intervalSeconds}\n` +
    `Duração do bloqueio (segundos): ${config.blockDurationSeconds}\n` +
    `Bloqueios antes do permanente: ${config.maxBlocksBeforePermanent}`;

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔢 Máx. mensagens', callback_data: 'antiflood_set_max' }],
        [{ text: '⏱️ Intervalo', callback_data: 'antiflood_set_interval' }],
        [{ text: '⏳ Duração bloqueio', callback_data: 'antiflood_set_duration' }],
        [{ text: '🔁 Bloqueios p/ permanente', callback_data: 'antiflood_set_blocks' }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_menu_actions' }],
      ],
    },
  });
}

export async function setAntifloodParam(ctx: Context, param: string) {
  if (!(await isAdmin(ctx))) return;

  const paramMap: Record<string, { key: string; label: string }> = {
    max: { key: 'maxMessages', label: 'Digite o novo máximo de mensagens:' },
    interval: { key: 'intervalSeconds', label: 'Digite o novo intervalo em segundos:' },
    duration: { key: 'blockDurationSeconds', label: 'Digite a nova duração do bloqueio em segundos:' },
    blocks: { key: 'maxBlocksBeforePermanent', label: 'Digite o número de bloqueios antes do permanente:' },
  };

  const p = paramMap[param];
  if (!p) return ctx.editMessage('Parâmetro inválido.');

  await startCapture(ctx, `antiflood_${param}`, p.label, {
    validate: async (input) => {
      const num = parseInt(input);
      return isNaN(num) || num < 1 ? 'Valor inválido.' : null;
    },
    onSuccess: async (ctx, value) => {
      const num = parseInt(value);
      const setting = await prisma.setting.findUnique({ where: { key: 'antiflood' } });
      const config = setting?.value as any || {};
      config[p.key] = num;
      await prisma.setting.upsert({
        where: { key: 'antiflood' },
        update: { value: config },
        create: { key: 'antiflood', value: config },
      });
      await ctx.editMessage('✅ Parâmetro atualizado.', {
        reply_markup: {
          inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'antiflood_menu' }]],
        },
      });
    },
  });
}
