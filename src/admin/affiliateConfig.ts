import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';
import { logAction } from '../services/logger';

// Mostra painel de configuração de afiliados
export async function showAffiliateConfig(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const pointsMin = await prisma.setting.findUnique({ where: { key: 'affiliate_points_min' } });
  const multiplier = await prisma.setting.findUnique({ where: { key: 'affiliate_multiplier' } });
  const systemOn = await prisma.setting.findUnique({ where: { key: 'affiliate_system' } });
  const pointsPerRecharge = await prisma.setting.findUnique({ where: { key: 'affiliate_points_per_recharge' } });

  const min = pointsMin ? parseInt(pointsMin.value.toString()) : 500;
  const mult = multiplier ? parseFloat(multiplier.value.toString()) : 0.01;
  const on = systemOn ? systemOn.value : false;
  const points = pointsPerRecharge ? parseInt(pointsPerRecharge.value.toString()) : 1;

  const text = `💰 CONFIGURAR AFILIADOS\n\n` +
    `Sistema de indicação: ${on ? '🟢 On' : '🔴 Off'}\n` +
    `Pontos por recarga: ${points}\n` +
    `Pontos mínimos para converter: ${min}\n` +
    `Multiplicador para converter: ${mult}`;

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: `SISTEMA DE INDICAÇÃO (${on ? 'on' : 'off'})`, callback_data: 'aff_toggle_system' }],
        [{ text: 'PONTOS POR RECARGA', callback_data: 'aff_set_points' }],
        [{ text: 'PONTOS MINIMO PARA CONVERTER', callback_data: 'aff_set_min' }],
        [{ text: 'MULTIPLICADOR PARA CONVERTER', callback_data: 'aff_set_multiplier' }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_config' }],
      ],
    },
  });
}

// Alterna sistema de indicação
export async function toggleAffiliateSystem(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const setting = await prisma.setting.findUnique({ where: { key: 'affiliate_system' } });
  const current = setting?.value || false;
  await prisma.setting.upsert({
    where: { key: 'affiliate_system' },
    update: { value: !current },
    create: { key: 'affiliate_system', value: !current },
  });
  await showAffiliateConfig(ctx);
}

// Define pontos por recarga
export async function setAffiliatePoints(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'aff_points', 'Digite a quantidade de pontos por recarga:', {
    validate: async (input) => {
      const num = parseInt(input);
      return isNaN(num) || num < 0 ? 'Valor inválido.' : null;
    },
    onSuccess: async (ctx, value) => {
      await prisma.setting.upsert({
        where: { key: 'affiliate_points_per_recharge' },
        update: { value: parseInt(value) },
        create: { key: 'affiliate_points_per_recharge', value: parseInt(value) },
      });
      await ctx.editMessage('✅ Pontos por recarga atualizados.');
      await showAffiliateConfig(ctx);
    },
  });
}

// Define pontos mínimos
export async function setAffiliateMin(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'aff_min', 'Digite os pontos mínimos para converter:', {
    validate: async (input) => {
      const num = parseInt(input);
      return isNaN(num) || num < 0 ? 'Valor inválido.' : null;
    },
    onSuccess: async (ctx, value) => {
      await prisma.setting.upsert({
        where: { key: 'affiliate_points_min' },
        update: { value: parseInt(value) },
        create: { key: 'affiliate_points_min', value: parseInt(value) },
      });
      await ctx.editMessage('✅ Pontos mínimos atualizados.');
      await showAffiliateConfig(ctx);
    },
  });
}

// Define multiplicador
export async function setAffiliateMultiplier(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'aff_multiplier', 'Digite o multiplicador (ex: 0.01):', {
    validate: async (input) => {
      const num = parseFloat(input);
      return isNaN(num) || num < 0 ? 'Valor inválido.' : null;
    },
    onSuccess: async (ctx, value) => {
      await prisma.setting.upsert({
        where: { key: 'affiliate_multiplier' },
        update: { value: parseFloat(value) },
        create: { key: 'affiliate_multiplier', value: parseFloat(value) },
      });
      await ctx.editMessage('✅ Multiplicador atualizado.');
      await showAffiliateConfig(ctx);
    },
  });
}
