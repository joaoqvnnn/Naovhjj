import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';

export async function showSupportConfig(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const supportLink = await prisma.setting.findUnique({ where: { key: 'support_link' } });
  const version = await prisma.setting.findUnique({ where: { key: 'bot_version' } });
  const storeName = await prisma.setting.findUnique({ where: { key: 'store_name' } });

  const link = supportLink?.value || 'Não definido';
  const versao = version?.value || '4.1.0';
  const nome = storeName?.value || 'Larizinha Store';

  await ctx.editMessage(
    `⚙️ Suporte e Loja\n\n` +
    `Link de suporte: ${link}\n` +
    `Versão: ${versao}\n` +
    `Nome da loja: ${nome}`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔗 Editar link', callback_data: 'support_edit_link' }],
          [{ text: '📝 Editar versão', callback_data: 'support_edit_version' }],
          [{ text: '🏪 Editar nome', callback_data: 'support_edit_store' }],
          [{ text: '⏮️ Voltar', callback_data: 'admin_menu_config' }],
        ],
      },
    }
  );
}

export async function editSupportLink(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'support_link', 'Digite o link de suporte:', {
    validate: async (input) => input.startsWith('http') ? null : 'URL inválida.',
    onSuccess: async (ctx, link) => {
      await prisma.setting.upsert({ where: { key: 'support_link' }, update: { value: link }, create: { key: 'support_link', value: link } });
      await ctx.editMessage('✅ Link atualizado.');
      await showSupportConfig(ctx);
    },
  });
}

export async function editBotVersion(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'bot_version', 'Digite a versão:', {
    validate: async (input) => input.trim().length > 0 ? null : 'Versão inválida.',
    onSuccess: async (ctx, version) => {
      await prisma.setting.upsert({ where: { key: 'bot_version' }, update: { value: version }, create: { key: 'bot_version', value: version } });
      await ctx.editMessage('✅ Versão atualizada.');
      await showSupportConfig(ctx);
    },
  });
}

export async function editStoreName(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'store_name', 'Digite o nome da loja:', {
    validate: async (input) => input.trim().length > 0 ? null : 'Nome inválido.',
    onSuccess: async (ctx, name) => {
      await prisma.setting.upsert({ where: { key: 'store_name' }, update: { value: name }, create: { key: 'store_name', value: name } });
      await ctx.editMessage('✅ Nome atualizado.');
      await showSupportConfig(ctx);
    },
  });
}
