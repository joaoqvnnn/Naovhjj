import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';
import { logAction } from '../services/logger';

export async function showWhatsAppConfig(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const apiConfig = await prisma.setting.findUnique({ where: { key: 'whatsapp_api' } });
  const config = apiConfig?.value as any || { url: '', apikey: '', instance: '' };

  const text = `📱 CONFIGURAÇÃO WHATSAPP\n\n` +
    `URL: ${config.url || 'Não configurada'}\n` +
    `API Key: ${config.apikey ? '********' : 'Não configurada'}\n` +
    `Instância: ${config.instance || 'Não configurada'}\n\n` +
    `Selecione:`;

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔗 Configurar URL', callback_data: 'wa_set_url' }],
        [{ text: '🔑 Configurar API Key', callback_data: 'wa_set_apikey' }],
        [{ text: '📂 Configurar Instância', callback_data: 'wa_set_instance' }],
        [{ text: '📝 Editar mensagens', callback_data: 'wa_edit_messages' }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_config' }],
      ],
    },
  });
}

export async function setWhatsAppUrl(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'wa_url', 'Digite a URL da API do WhatsApp (ex: https://api.evolution.com):', {
    validate: async (input) => input.startsWith('http') ? null : 'URL inválida.',
    onSuccess: async (ctx, url) => {
      const config = await prisma.setting.findUnique({ where: { key: 'whatsapp_api' } });
      const current = config?.value as any || {};
      current.url = url;
      await prisma.setting.upsert({ where: { key: 'whatsapp_api' }, update: { value: current }, create: { key: 'whatsapp_api', value: current } });
      await ctx.editMessage('✅ URL configurada.');
      await showWhatsAppConfig(ctx);
    },
  });
}

export async function setWhatsAppApiKey(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'wa_apikey', 'Digite a API Key:', {
    validate: async (input) => input.length > 0 ? null : 'Chave inválida.',
    onSuccess: async (ctx, apikey) => {
      const config = await prisma.setting.findUnique({ where: { key: 'whatsapp_api' } });
      const current = config?.value as any || {};
      current.apikey = apikey;
      await prisma.setting.upsert({ where: { key: 'whatsapp_api' }, update: { value: current }, create: { key: 'whatsapp_api', value: current } });
      await ctx.editMessage('✅ API Key configurada.');
      await showWhatsAppConfig(ctx);
    },
  });
}

export async function setWhatsAppInstance(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'wa_instance', 'Digite o nome da instância:', {
    validate: async (input) => input.length > 0 ? null : 'Instância inválida.',
    onSuccess: async (ctx, instance) => {
      const config = await prisma.setting.findUnique({ where: { key: 'whatsapp_api' } });
      const current = config?.value as any || {};
      current.instance = instance;
      await prisma.setting.upsert({ where: { key: 'whatsapp_api' }, update: { value: current }, create: { key: 'whatsapp_api', value: current } });
      await ctx.editMessage('✅ Instância configurada.');
      await showWhatsAppConfig(ctx);
    },
  });
}

export async function editWhatsAppMessages(ctx: Context) {
  // Pode abrir editor de templates (já existente) para as chaves relacionadas
  // Por simplicidade, apenas informa as chaves disponíveis
  await ctx.editMessage('📝 Edite os templates:\n\n- whatsapp_compra\n- whatsapp_ativacao_senha\n- whatsapp_liberacao\n\nUse o Editor de Mensagens no menu principal.', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '⏮️ Voltar', callback_data: 'wa_config' }],
      ],
    },
  });
}
