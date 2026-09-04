import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';

export async function showResearchConfig(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const imagesSetting = await prisma.setting.findUnique({ where: { key: 'research_images' } });
  const images = imagesSetting?.value as string[] || [];

  await ctx.editMessage(
    `🔎 Configuração da Pesquisa de Serviços\n\nImagens salvas: ${images.length}\nSistema: Ativo`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'ADICIONAR IMAGEM', callback_data: 'research_add_image' }],
          [{ text: 'REMOVER IMAGEM', callback_data: 'research_remove_image' }],
          [{ text: '⏮️ Voltar', callback_data: 'admin_menu_config' }],
        ],
      },
    }
  );
}

export async function addResearchImage(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'research_add_image', 'Envie a URL da imagem:', {
    validate: async (input) => input.startsWith('http') ? null : 'URL inválida.',
    onSuccess: async (ctx, url) => {
      const setting = await prisma.setting.findUnique({ where: { key: 'research_images' } });
      const images = setting?.value as string[] || [];
      images.push(url);
      await prisma.setting.upsert({ where: { key: 'research_images' }, update: { value: images }, create: { key: 'research_images', value: images } });
      await ctx.editMessage('✅ Imagem adicionada.');
      await showResearchConfig(ctx);
    },
  });
}

export async function removeResearchImage(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const setting = await prisma.setting.findUnique({ where: { key: 'research_images' } });
  const images = setting?.value as string[] || [];
  if (!images.length) return ctx.editMessage('Nenhuma imagem para remover.');

  const listStr = images.map((img, i) => `${i + 1}. ${img}`).join('\n');
  await startCapture(ctx, 'research_remove_image', `Digite o número da imagem:\n\n${listStr}`, {
    validate: async (input) => {
      const idx = parseInt(input) - 1;
      return (idx < 0 || idx >= images.length) ? 'Número inválido.' : null;
    },
    onSuccess: async (ctx, value) => {
      const idx = parseInt(value) - 1;
      images.splice(idx, 1);
      await prisma.setting.update({ where: { key: 'research_images' }, data: { value: images } });
      await ctx.editMessage('✅ Imagem removida.');
      await showResearchConfig(ctx);
    },
  });
}
