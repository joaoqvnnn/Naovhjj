import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';

export async function showTranscriptionConfig(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const setting = await prisma.setting.findUnique({ where: { key: 'transcription_enabled' } });
  const enabled = setting ? setting.value : false;
  const apiKey = process.env.OPENAI_API_KEY ? '********' : 'Não configurada';

  await ctx.editMessage(`Transcrição de Áudio\n\nStatus: ${enabled ? 'Ativada' : 'Desativada'}\nAPI Key: ${apiKey}\n\nEscolha:`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: enabled ? 'Desativar' : 'Ativar', callback_data: 'transcription_toggle' }],
        [{ text: 'Configurar API Key', callback_data: 'transcription_set_key' }],
        [{ text: 'Voltar', callback_data: 'admin_menu_actions' }],
      ],
    },
  });
}

export async function toggleTranscription(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const setting = await prisma.setting.findUnique({ where: { key: 'transcription_enabled' } });
  const current = setting?.value || false;
  await prisma.setting.upsert({
    where: { key: 'transcription_enabled' },
    update: { value: !current },
    create: { key: 'transcription_enabled', value: !current },
  });
  await showTranscriptionConfig(ctx);
}

export async function setTranscriptionKey(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'transcription_key', 'Digite a OpenAI API Key para transcrição:', {
    validate: async (input) => input.length > 0 ? null : 'Chave inválida.',
    onSuccess: async (ctx, key) => {
      // Salva em variável de ambiente (em produção, usar secret manager)
      process.env.OPENAI_API_KEY = key;
      await ctx.editMessage('API Key atualizada em memória.');
      await showTranscriptionConfig(ctx);
    },
  });
}
