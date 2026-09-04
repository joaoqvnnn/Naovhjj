import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';

export async function showSobreConfig(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const template = await prisma.messageTemplate.findUnique({ where: { key: 'sobre' } });
  const current = template?.text || 'Conteúdo padrão não definido.';

  await ctx.editMessage(`Página Sobre\n\nConteúdo atual:\n\n${current}`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '✏️ Editar conteúdo', callback_data: 'sobre_edit' }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_menu_config' }],
      ],
    },
  });
}

export async function editSobreContent(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  await startCapture(ctx, 'sobre_content', 'Digite o novo conteúdo da página Sobre:', {
    validate: async (input) => input.trim().length > 0 ? null : 'Conteúdo vazio.',
    onSuccess: async (ctx, text) => {
      await prisma.messageTemplate.upsert({ where: { key: 'sobre' }, update: { text }, create: { key: 'sobre', text } });
      await ctx.editMessage('✅ Conteúdo atualizado.');
      await showSobreConfig(ctx);
    },
  });
}
