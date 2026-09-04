import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';
import { logAction } from '../services/logger';

// Mostra menu de segurança
export async function showSecurityConfig(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const twoFactor = await prisma.setting.findUnique({ where: { key: 'two_factor_enabled' } });
  const deviceSecurity = await prisma.setting.findUnique({ where: { key: 'device_security' } });
  const passwordAttempts = await prisma.setting.findUnique({ where: { key: 'max_password_attempts' } });
  const blockDuration = await prisma.setting.findUnique({ where: { key: 'block_duration_minutes' } });

  const twoFactorEnabled = twoFactor?.value || false;
  const deviceEnabled = deviceSecurity?.value?.enabled || false;
  const deviceStrict = deviceSecurity?.value?.strict || false;
  const maxAttempts = passwordAttempts ? parseInt(passwordAttempts.value.toString()) : 5;
  const blockMin = blockDuration ? parseInt(blockDuration.value.toString()) : 30;

  const text = `🔐 SEGURANÇA\n\n` +
    `Autenticação em duas etapas (2FA): ${twoFactorEnabled ? '✅ Ativada' : '❌ Desativada'}\n` +
    `Proteção por dispositivo: ${deviceEnabled ? '✅ Ativada' : '❌ Desativada'}\n` +
    `Modo estrito (IP + navegador): ${deviceStrict ? '✅ Sim' : '❌ Não'}\n` +
    `Tentativas de senha: ${maxAttempts}\n` +
    `Bloqueio após tentativas: ${blockMin} minutos\n\n` +
    `Escolha uma opção:`;

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: `🔑 2FA: ${twoFactorEnabled ? 'Desativar' : 'Ativar'}`, callback_data: 'security_toggle_2fa' }],
        [{ text: `📱 Dispositivo: ${deviceEnabled ? 'Desativar' : 'Ativar'}`, callback_data: 'security_toggle_device' }],
        [{ text: `🛡️ Modo estrito: ${deviceStrict ? 'Desativar' : 'Ativar'}`, callback_data: 'security_toggle_strict' }],
        [{ text: '🔢 Tentativas de senha', callback_data: 'security_set_attempts' }],
        [{ text: '⏳ Bloqueio (minutos)', callback_data: 'security_set_block' }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_menu_config' }],
      ],
    },
  });
}

// Alterna 2FA
export async function toggle2FA(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const setting = await prisma.setting.findUnique({ where: { key: 'two_factor_enabled' } });
  const current = setting?.value || false;
  await prisma.setting.upsert({
    where: { key: 'two_factor_enabled' },
    update: { value: !current },
    create: { key: 'two_factor_enabled', value: !current },
  });
  await logAction({ action: 'SECURITY_2FA_TOGGLED', details: { enabled: !current } });
  await showSecurityConfig(ctx);
}

// Alterna proteção por dispositivo
export async function toggleDeviceSecurity(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const setting = await prisma.setting.findUnique({ where: { key: 'device_security' } });
  const current = setting?.value?.enabled || false;
  await prisma.setting.upsert({
    where: { key: 'device_security' },
    update: { value: { enabled: !current, strict: setting?.value?.strict || false } },
    create: { key: 'device_security', value: { enabled: !current, strict: false } },
  });
  await logAction({ action: 'SECURITY_DEVICE_TOGGLED', details: { enabled: !current } });
  await showSecurityConfig(ctx);
}

// Alterna modo estrito
export async function toggleStrictDevice(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const setting = await prisma.setting.findUnique({ where: { key: 'device_security' } });
  const current = setting?.value?.strict || false;
  await prisma.setting.upsert({
    where: { key: 'device_security' },
    update: { value: { enabled: setting?.value?.enabled || false, strict: !current } },
    create: { key: 'device_security', value: { enabled: false, strict: !current } },
  });
  await logAction({ action: 'SECURITY_STRICT_TOGGLED', details: { strict: !current } });
  await showSecurityConfig(ctx);
}

// Define tentativas de senha
export async function setMaxPasswordAttempts(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'security_attempts', 'Digite o número máximo de tentativas de senha (ex: 5):', {
    validate: async (input) => {
      const num = parseInt(input);
      return isNaN(num) || num < 1 ? 'Valor inválido.' : null;
    },
    onSuccess: async (ctx, value) => {
      const num = parseInt(value);
      await prisma.setting.upsert({
        where: { key: 'max_password_attempts' },
        update: { value: num },
        create: { key: 'max_password_attempts', value: num },
      });
      await ctx.editMessage(`✅ Tentativas configuradas para ${num}.`);
      await showSecurityConfig(ctx);
    },
  });
}

// Define duração do bloqueio
export async function setBlockDuration(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'security_block', 'Digite a duração do bloqueio em minutos (ex: 30):', {
    validate: async (input) => {
      const num = parseInt(input);
      return isNaN(num) || num < 1 ? 'Valor inválido.' : null;
    },
    onSuccess: async (ctx, value) => {
      const num = parseInt(value);
      await prisma.setting.upsert({
        where: { key: 'block_duration_minutes' },
        update: { value: num },
        create: { key: 'block_duration_minutes', value: num },
      });
      await ctx.editMessage(`✅ Bloqueio configurado para ${num} minutos.`);
      await showSecurityConfig(ctx);
    },
  });
}
