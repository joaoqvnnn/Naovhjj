import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';

// Mostra o menu de configuração anti-flood
export async function showAntifloodConfig(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const config = await prisma.setting.findUnique({ where: { key: 'antiflood' } });
  const current = config?.value as any || {
    maxMessages: 10,
    intervalSeconds: 10,
    blockDurationSeconds: 60,
    maxBlocksBeforePermanent: 3,
  };

  const text = `🛡️ CONFIGURAÇÃO ANTI-FLOOD\n\n` +
    `Máximo de mensagens: ${current.maxMessages}\n` +
    `Intervalo (segundos): ${current.intervalSeconds}\n` +
    `Duração do bloqueio (segundos): ${current.blockDurationSeconds}\n` +
    `Bloqueios antes do permanente: ${current.maxBlocksBeforePermanent}\n\n` +
    `Selecione o parâmetro para alterar:`;

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔢 Máx. mensagens', callback_data: 'antiflood_set_max' }],
        [{ text: '⏱️ Intervalo', callback_data: 'antiflood_set_interval' }],
        [{ text: '⏳ Duração bloqueio', callback_data: 'antiflood_set_duration' }],
        [{ text: '🔁 Bloqueios p/ permanente', callback_data: 'antiflood_set_blocks' }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_config' }],
      ],
    },
  });
}

// Inicia captura para alterar cada parâmetro
export async function setAntifloodParam(ctx: Context, param: string) {
  if (!(await isAdmin(ctx))) return;

  const paramMap: Record<string, { key: keyof any; label: string }> = {
    max: { key: 'maxMessages', label: 'Digite o novo máximo de mensagens:' },
    interval: { key: 'intervalSeconds', label: 'Digite o novo intervalo em segundos:' },
    duration: { key: 'blockDurationSeconds', label: 'Digite a nova duração do bloqueio em segundos:' },
    blocks: { key: 'maxBlocksBeforePermanent', label: 'Digite o número de bloqueios antes do permanente:' },
  };

  const p = paramMap[param];
  if (!p) return;

  await startCapture(ctx, `antiflood_${param}`, p.label, {
    validate: async (input) => {
      const num = parseInt(input);
      if (isNaN(num) || num < 1) return '❌ Valor inválido. Digite um número positivo.';
      return null;
    },
    onSuccess: async (ctx, value) => {
      const num = parseInt(value);
      const config = await prisma.setting.findUnique({ where: { key: 'antiflood' } });
      const current = config?.value as any || {
        maxMessages: 10,
        intervalSeconds: 10,
        blockDurationSeconds: 60,
        maxBlocksBeforePermanent: 3,
      };
      current[p.key] = num;
      await prisma.setting.upsert({
        where: { key: 'antiflood' },
        update: { value: current },
        create: { key: 'antiflood', value: current },
      });
      await ctx.editMessage(`✅ Parâmetro atualizado com sucesso!`);
      await showAntifloodConfig(ctx);
    },
  });
}
