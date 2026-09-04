import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';

export async function showSecurityConfig(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const twoFactor = await prisma.setting.findUnique({ where: { key: 'two_factor_enabled' } });
  const deviceSecurity = await prisma.setting.findUnique({ where: { key: 'device_security' } });
  const maxAttempts = await prisma.setting.findUnique({ where: { key: 'max_password_attempts' } });
  const blockDuration = await prisma.setting.findUnique({ where: { key: 'block_duration_minutes' } });

  const twoFactorEnabled = twoFactor?.value || false;
  const deviceEnabled = deviceSecurity?.value?.enabled || false;
  const deviceStrict = deviceSecurity?.value?.strict || false;
  const attempts = maxAttempts ? parseInt(maxAttempts.value.toString()) : 5;
  const blockMin = blockDuration ? parseInt(blockDuration.value.toString()) : 30;

  await ctx.editMessage(
    `🔐 Segurança\n\n` +
    `2FA: ${twoFactorEnabled ? '✅' : '❌'}\n` +
    `Proteção por dispositivo: ${deviceEnabled ? '✅' : '❌'}\n` +
    `Modo estrito: ${deviceStrict ? '✅' : '❌'}\n` +
    `Tentativas de senha: ${attempts}\n` +
    `Bloqueio: ${blockMin} min`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: `2FA: ${twoFactorEnabled ? 'Desativar' : 'Ativar'}`, callback_data: 'security_toggle_2fa' }],
          [{ text: `Dispositivo: ${deviceEnabled ? 'Desativar' : 'Ativar'}`, callback_data: 'security_toggle_device' }],
          [{ text: `Estrito: ${deviceStrict ? 'Desativar' : 'Ativar'}`, callback_data: 'security_toggle_strict' }],
          [{ text: 'Tentativas de senha', callback_data: 'security_set_attempts' }],
          [{ text: 'Bloqueio (minutos)', callback_data: 'security_set_block' }],
          [{ text: '⏮️ Voltar', callback_data: 'admin_menu_config' }],
        ],
      },
    }
  );
}

export async function toggle2FA(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const setting = await prisma.setting.findUnique({ where: { key: 'two_factor_enabled' } });
  const current = setting?.value || false;
  await prisma.setting.upsert({ where: { key: 'two_factor_enabled' }, update: { value: !current }, create: { key: 'two_factor_enabled', value: !current } });
  await ctx.editMessage('✅ 2FA atualizado.');
  await showSecurityConfig(ctx);
}

export async function toggleDeviceSecurity(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const setting = await prisma.setting.findUnique({ where: { key: 'device_security' } });
  const current = setting?.value?.enabled || false;
  await prisma.setting.upsert({
    where: { key: 'device_security' },
    update: { value: { enabled: !current, strict: setting?.value?.strict || false } },
    create: { key: 'device_security', value: { enabled: !current, strict: false } },
  });
  await ctx.editMessage('✅ Proteção por dispositivo atualizada.');
  await showSecurityConfig(ctx);
}

export async function toggleStrictDevice(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const setting = await prisma.setting.findUnique({ where: { key: 'device_security' } });
  const current = setting?.value?.strict || false;
  await prisma.setting.upsert({
    where: { key: 'device_security' },
    update: { value: { enabled: setting?.value?.enabled || false, strict: !current } },
    create: { key: 'device_security', value: { enabled: false, strict: !current } },
  });
  await ctx.editMessage('✅ Modo estrito atualizado.');
  await showSecurityConfig(ctx);
}

export async function setMaxPasswordAttempts(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'security_attempts', 'Digite o número máximo de tentativas:', {
    validate: async (input) => {
      const num = parseInt(input);
      return isNaN(num) || num < 1 ? 'Valor inválido.' : null;
    },
    onSuccess: async (ctx, value) => {
      await prisma.setting.upsert({ where: { key: 'max_password_attempts' }, update: { value: parseInt(value) }, create: { key: 'max_password_attempts', value: parseInt(value) } });
      await ctx.editMessage('✅ Tentativas atualizadas.');
      await showSecurityConfig(ctx);
    },
  });
}

export async function setBlockDuration(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'security_block', 'Digite a duração do bloqueio em minutos:', {
    validate: async (input) => {
      const num = parseInt(input);
      return isNaN(num) || num < 1 ? 'Valor inválido.' : null;
    },
    onSuccess: async (ctx, value) => {
      await prisma.setting.upsert({ where: { key: 'block_duration_minutes' }, update: { value: parseInt(value) }, create: { key: 'block_duration_minutes', value: parseInt(value) } });
      await ctx.editMessage('✅ Bloqueio atualizado.');
      await showSecurityConfig(ctx);
    },
  });
}
