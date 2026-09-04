import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';

export async function showGeneralConfig(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const logDest = await prisma.setting.findUnique({ where: { key: 'log_destination' } });
  const support = await prisma.setting.findUnique({ where: { key: 'support_link' } });
  const separator = await prisma.setting.findUnique({ where: { key: 'separator' } });
  const maintenance = await prisma.setting.findUnique({ where: { key: 'maintenance' } });

  const dest = logDest?.value || 'Não definido';
  const sup = support?.value || 'Não definido';
  const sep = separator?.value || '===';
  const maint = maintenance?.value?.enabled || false;

  await ctx.editMessage(
    `⚙️ CONFIGURAÇÕES GERAIS\n\n` +
    `Destino logs: ${dest}\n` +
    `Suporte: ${sup}\n` +
    `Separador: ${sep}\n` +
    `Manutenção: ${maint ? 'ON' : 'OFF'}`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'MUDAR SUPORTE', callback_data: 'config_support' }],
          [{ text: 'MUDAR SEPARADOR', callback_data: 'config_separator' }],
          [{ text: 'MUDAR DESTINO LOG', callback_data: 'config_logdest' }],
          [{ text: `MANUTENÇÃO (${maint ? 'on' : 'off'})`, callback_data: 'config_maintenance' }],
          [{ text: 'REINICIAR BOT', callback_data: 'config_restart' }],
          [{ text: '⏮️ Voltar', callback_data: 'admin_menu_config' }],
        ],
      },
    }
  );
}

export async function setSupport(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'config_support', 'Digite o link de suporte:', {
    validate: async (input) => input.startsWith('http') ? null : 'URL inválida.',
    onSuccess: async (ctx, url) => {
      await prisma.setting.upsert({ where: { key: 'support_link' }, update: { value: url }, create: { key: 'support_link', value: url } });
      await ctx.editMessage('✅ Suporte atualizado.');
      await showGeneralConfig(ctx);
    },
  });
}

export async function setSeparator(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'config_separator', 'Digite o novo separador:', {
    validate: async (input) => input.length > 0 && input.length <= 10 ? null : 'Inválido.',
    onSuccess: async (ctx, sep) => {
      await prisma.setting.upsert({ where: { key: 'separator' }, update: { value: sep }, create: { key: 'separator', value: sep } });
      await ctx.editMessage('✅ Separador atualizado.');
      await showGeneralConfig(ctx);
    },
  });
}

export async function setLogDestination(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'config_logdest', 'Digite o ID do chat para logs:', {
    validate: async (input) => /^-?\d+$/.test(input) ? null : 'ID inválido.',
    onSuccess: async (ctx, dest) => {
      await prisma.setting.upsert({ where: { key: 'log_destination' }, update: { value: dest }, create: { key: 'log_destination', value: dest } });
      await ctx.editMessage('✅ Destino de logs atualizado.');
      await showGeneralConfig(ctx);
    },
  });
}

export async function toggleMaintenance(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const setting = await prisma.setting.findUnique({ where: { key: 'maintenance' } });
  const enabled = !(setting?.value?.enabled || false);
  await prisma.setting.upsert({ where: { key: 'maintenance' }, update: { value: { enabled } }, create: { key: 'maintenance', value: { enabled } } });
  await ctx.editMessage(`🛠️ Manutenção ${enabled ? 'ativada' : 'desativada'}.`);
  await showGeneralConfig(ctx);
}

export async function restartBot(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await ctx.editMessage('🔄 Reiniciando bot...');
  setTimeout(() => process.exit(0), 1000);
}
