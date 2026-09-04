import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';
import { logAction } from '../services/logger';

// Mostra menu de configuração do Pix
export async function showPixConfig(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const pixConfig = await prisma.setting.findUnique({ where: { key: 'pix_config' } });
  const config = pixConfig?.value as any || {
    mode: 'automatico', // 'automatico' ou 'manual'
    manualPixKey: '',
    showQrCode: true,
    showCopyButton: true,
    expirationMinutes: 10,
    minAmount: 4,
    maxAmount: 1000,
  };

  const text = `💳 CONFIGURAÇÃO PIX\n\n` +
    `Modo: ${config.mode === 'automatico' ? '🟢 Automático' : '🟡 Manual'}\n` +
    `QR Code: ${config.showQrCode ? '✅' : '❌'}\n` +
    `Botão copiar: ${config.showCopyButton ? '✅' : '❌'}\n` +
    `Expira em: ${config.expirationMinutes} min\n` +
    `Mínimo: R$ ${config.minAmount}\n` +
    `Máximo: R$ ${config.maxAmount}\n\n` +
    `Selecione para alterar:`;

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔄 Alternar modo', callback_data: 'pixcfg_toggle_mode' }],
        [{ text: '🔑 Chave Pix manual', callback_data: 'pixcfg_set_key' }],
        [{ text: '🖼 QR Code on/off', callback_data: 'pixcfg_toggle_qr' }],
        [{ text: '📋 Botão copiar on/off', callback_data: 'pixcfg_toggle_copy' }],
        [{ text: '⏱️ Expiração', callback_data: 'pixcfg_set_expiration' }],
        [{ text: '💰 Mínimo', callback_data: 'pixcfg_set_min' }],
        [{ text: '💰 Máximo', callback_data: 'pixcfg_set_max' }],
        [{ text: '📝 Editar mensagem Pix', callback_data: 'pixcfg_edit_message' }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_config' }],
      ],
    },
  });
}

// Alterna entre automático e manual
export async function togglePixMode(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const pixConfig = await prisma.setting.findUnique({ where: { key: 'pix_config' } });
  const config = pixConfig?.value as any || {
    mode: 'automatico', manualPixKey: '', showQrCode: true, showCopyButton: true,
    expirationMinutes: 10, minAmount: 4, maxAmount: 1000,
  };
  config.mode = config.mode === 'automatico' ? 'manual' : 'automatico';
  await prisma.setting.upsert({
    where: { key: 'pix_config' },
    update: { value: config },
    create: { key: 'pix_config', value: config },
  });
  await logAction({ action: 'PIX_MODE_CHANGED', details: { mode: config.mode } });
  await showPixConfig(ctx);
}

// Define chave Pix manual
export async function setManualPixKey(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'pixcfg_key', 'Digite a chave Pix manual (CPF, CNPJ, e-mail, telefone ou aleatória):', {
    validate: async (input) => input.trim().length > 0 ? null : 'Chave inválida.',
    onSuccess: async (ctx, key) => {
      const pixConfig = await prisma.setting.findUnique({ where: { key: 'pix_config' } });
      const config = pixConfig?.value as any || {};
      config.manualPixKey = key.trim();
      await prisma.setting.upsert({
        where: { key: 'pix_config' },
        update: { value: config },
        create: { key: 'pix_config', value: config },
      });
      await ctx.editMessage('✅ Chave Pix manual atualizada.');
      await showPixConfig(ctx);
    },
  });
}

// Alterna exibição do QR Code
export async function toggleQrCode(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const pixConfig = await prisma.setting.findUnique({ where: { key: 'pix_config' } });
  const config = pixConfig?.value as any || {};
  config.showQrCode = !config.showQrCode;
  await prisma.setting.upsert({
    where: { key: 'pix_config' },
    update: { value: config },
    create: { key: 'pix_config', value: config },
  });
  await showPixConfig(ctx);
}

// Alterna botão de copiar
export async function toggleCopyButton(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const pixConfig = await prisma.setting.findUnique({ where: { key: 'pix_config' } });
  const config = pixConfig?.value as any || {};
  config.showCopyButton = !config.showCopyButton;
  await prisma.setting.upsert({
    where: { key: 'pix_config' },
    update: { value: config },
    create: { key: 'pix_config', value: config },
  });
  await showPixConfig(ctx);
}

// Define expiração (minutos) - editável
export async function setExpiration(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'pixcfg_expiration', 'Digite o tempo de expiração em minutos:', {
    validate: async (input) => {
      const num = parseInt(input);
      if (isNaN(num) || num < 1) return 'Valor inválido.';
      return null;
    },
    onSuccess: async (ctx, value) => {
      const num = parseInt(value);
      const pixConfig = await prisma.setting.findUnique({ where: { key: 'pix_config' } });
      const config = pixConfig?.value as any || {};
      config.expirationMinutes = num;
      await prisma.setting.upsert({
        where: { key: 'pix_config' },
        update: { value: config },
        create: { key: 'pix_config', value: config },
      });
      await logAction({ action: 'PIX_EXPIRATION_CHANGED', details: { expirationMinutes: num } });
      await ctx.editMessage(`✅ Expiração configurada para ${num} minutos.`);
      await showPixConfig(ctx);
    },
  });
}

// Define valor mínimo
export async function setMinAmount(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'pixcfg_min', 'Digite o valor mínimo para recarga:', {
    validate: async (input) => {
      const num = parseFloat(input.replace(',', '.'));
      if (isNaN(num) || num < 0) return 'Valor inválido.';
      return null;
    },
    onSuccess: async (ctx, value) => {
      const num = parseFloat(value.replace(',', '.'));
      const pixConfig = await prisma.setting.findUnique({ where: { key: 'pix_config' } });
      const config = pixConfig?.value as any || {};
      config.minAmount = num;
      await prisma.setting.upsert({
        where: { key: 'pix_config' },
        update: { value: config },
        create: { key: 'pix_config', value: config },
      });
      await ctx.editMessage(`✅ Valor mínimo configurado para R$ ${num.toFixed(2)}.`);
      await showPixConfig(ctx);
    },
  });
}

// Define valor máximo
export async function setMaxAmount(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'pixcfg_max', 'Digite o valor máximo para recarga:', {
    validate: async (input) => {
      const num = parseFloat(input.replace(',', '.'));
      if (isNaN(num) || num < 0) return 'Valor inválido.';
      return null;
    },
    onSuccess: async (ctx, value) => {
      const num = parseFloat(value.replace(',', '.'));
      const pixConfig = await prisma.setting.findUnique({ where: { key: 'pix_config' } });
      const config = pixConfig?.value as any || {};
      config.maxAmount = num;
      await prisma.setting.upsert({
        where: { key: 'pix_config' },
        update: { value: config },
        create: { key: 'pix_config', value: config },
      });
      await ctx.editMessage(`✅ Valor máximo configurado para R$ ${num.toFixed(2)}.`);
      await showPixConfig(ctx);
    },
  });
}

// Edita mensagem do Pix (template)
export async function editPixMessage(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const template = await prisma.messageTemplate.findUnique({ where: { key: 'pix' } });
  const current = template?.text || 'Padrão';
  await startCapture(ctx, 'pixcfg_message', `Digite o novo texto da mensagem Pix (use variáveis como {valor}, {pix}, {id}):\n\nAtual: ${current}`, {
    validate: async (input) => input.length > 0 ? null : 'Texto vazio.',
    onSuccess: async (ctx, text) => {
      await prisma.messageTemplate.upsert({
        where: { key: 'pix' },
        update: { text },
        create: { key: 'pix', text },
      });
      await ctx.editMessage('✅ Mensagem Pix atualizada.');
      await showPixConfig(ctx);
    },
  });
}
