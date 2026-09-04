import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';
import { logAction } from '../services/logger';

// Mostra menu de configurações gerais
export async function showGeneralSettings(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const separator = await prisma.setting.findUnique({ where: { key: 'separator' } });
  const maintenance = await prisma.setting.findUnique({ where: { key: 'maintenance' } });
  const bonusRecharge = await prisma.setting.findUnique({ where: { key: 'bonus_recharge' } });
  const bonusRegister = await prisma.setting.findUnique({ where: { key: 'bonus_register' } });

  const sep = separator?.value || '===';
  const maint = maintenance?.value?.enabled || false;
  const bonusRec = bonusRecharge ? parseFloat(bonusRecharge.value.toString()) : 0;
  const bonusReg = bonusRegister ? parseFloat(bonusRegister.value.toString()) : 0;

  const text = `⚙️ CONFIGURAÇÕES GERAIS\n\n` +
    `🔤 Separador: ${sep}\n` +
    `🛠️ Manutenção: ${maint ? 'ATIVADA' : 'DESATIVADA'}\n` +
    `🎁 Bônus de recarga: ${bonusRec}%\n` +
    `🎁 Bônus de registro: ${formatCurrency(bonusReg)}\n\n` +
    `Selecione uma opção:`;

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔤 Alterar separador', callback_data: 'set_separator' }],
        [{ text: '🛠️ Alternar manutenção', callback_data: 'toggle_maintenance' }],
        [{ text: '🎁 Bônus recarga', callback_data: 'set_bonus_recharge' }],
        [{ text: '🎁 Bônus registro', callback_data: 'set_bonus_register' }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_config' }],
      ],
    },
  });
}

// Alterar separador
export async function setSeparator(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'new_separator', 'Digite o novo separador (ex: === ou ---):', {
    validate: async (input) => {
      if (input.length < 1 || input.length > 10) return '❌ Separador deve ter entre 1 e 10 caracteres.';
      return null;
    },
    onSuccess: async (ctx, value) => {
      await prisma.setting.upsert({
        where: { key: 'separator' },
        update: { value },
        create: { key: 'separator', value },
      });
      await logAction({ action: 'SEPARATOR_CHANGED', details: { new: value, by: ctx.from?.id } });
      await ctx.editMessage(`✅ Separador alterado para "${value}".`);
    },
  });
}

// Alternar manutenção
export async function toggleMaintenance(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const current = await prisma.setting.findUnique({ where: { key: 'maintenance' } });
  const enabled = !(current?.value?.enabled || false);
  await prisma.setting.upsert({
    where: { key: 'maintenance' },
    update: { value: { enabled } },
    create: { key: 'maintenance', value: { enabled } },
  });
  await logAction({ action: 'MAINTENANCE_TOGGLED', details: { enabled, by: ctx.from?.id } });
  await ctx.editMessage(`🛠️ Modo manutenção ${enabled ? 'ATIVADO' : 'DESATIVADO'}.`);
}

// Configurar bônus de recarga (%)
export async function setBonusRecharge(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'bonus_recharge', 'Digite o novo percentual de bônus de recarga (0-100):', {
    validate: async (input) => {
      const num = parseFloat(input);
      if (isNaN(num) || num < 0 || num > 100) return '❌ Valor inválido. Use entre 0 e 100.';
      return null;
    },
    onSuccess: async (ctx, value) => {
      const num = parseFloat(value);
      await prisma.setting.upsert({
        where: { key: 'bonus_recharge' },
        update: { value: num },
        create: { key: 'bonus_recharge', value: num },
      });
      await logAction({ action: 'BONUS_RECHARGE_CHANGED', details: { new: num, by: ctx.from?.id } });
      await ctx.editMessage(`✅ Bônus de recarga alterado para ${num}%.`);
    },
  });
}

// Configurar bônus de registro (valor fixo)
export async function setBonusRegister(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'bonus_register', 'Digite o valor do bônus de registro (ex: 5.00, 0 para desativar):', {
    validate: async (input) => {
      const num = parseFloat(input.replace(',', '.'));
      if (isNaN(num) || num < 0) return '❌ Valor inválido.';
      return null;
    },
    onSuccess: async (ctx, value) => {
      const num = parseFloat(value.replace(',', '.'));
      await prisma.setting.upsert({
        where: { key: 'bonus_register' },
        update: { value: num },
        create: { key: 'bonus_register', value: num },
      });
      await logAction({ action: 'BONUS_REGISTER_CHANGED', details: { new: num, by: ctx.from?.id } });
      await ctx.editMessage(`✅ Bônus de registro configurado para ${formatCurrency(num)}.`);
    },
  });
}
