import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';
import { logAction } from '../services/logger';

export async function showSobreConfig(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const template = await prisma.messageTemplate.findUnique({
    where: { key: 'sobre' },
  });

  const current = template?.text || 'Conteúdo padrão não definido.';

  await ctx.editMessage(`Página Sobre\n\nConteúdo atual:\n\n${current}\n\nClique em editar para alterar.`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '✏️ Editar conteúdo', callback_data: 'sobre_edit' }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_config_general' }],
      ],
    },
  });
}

export async function editSobreContent(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  await startCapture(ctx, 'sobre_content', 'Digite o novo conteúdo da página Sobre (use quebras de linha):', {
    validate: async (input) => input.trim().length > 0 ? null : 'Conteúdo vazio.',
    onSuccess: async (ctx, text) => {
      await prisma.messageTemplate.upsert({
        where: { key: 'sobre' },
        update: { text },
        create: { key: 'sobre', text },
      });

      await logAction({ action: 'SOBRE_CONTENT_UPDATED' });
      await ctx.editMessage('✅ Conteúdo da página Sobre atualizado.');
      await showSobreConfig(ctx);
    },
  });
}
