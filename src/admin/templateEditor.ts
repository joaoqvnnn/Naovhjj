import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';

const TEMPLATE_KEYS = [
  'start', 'perfil', 'produto', 'categoria', 'saldo_insuficiente', 'pix', 'pix_expirado',
  'pagamento_aprovado', 'compra_aprovada', 'entrega', 'historico', 'afiliados', 'saque',
  'giftcard', 'alerta', 'ranking', 'manutencao', 'erro', 'email_compra', 'whatsapp_compra',
];

export async function showTemplateList(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const buttons = TEMPLATE_KEYS.map(key => [{ text: `📝 ${key}`, callback_data: `template_view_${key}` }]);
  buttons.push([{ text: '⏮️ Voltar', callback_data: 'admin_menu_actions' }]);

  await ctx.editMessage('📝 Editor de Mensagens\n\nSelecione o template:', {
    reply_markup: { inline_keyboard: buttons },
  });
}

export async function viewTemplate(ctx: Context, key: string) {
  if (!(await isAdmin(ctx))) return;

  const template = await prisma.messageTemplate.findUnique({ where: { key } });
  const text = template?.text || 'Não personalizado. Usa padrão.';

  await ctx.editMessage(`📝 Template: ${key}\n\nTexto atual:\n\n${text}`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '✏️ Editar texto', callback_data: `template_edit_text_${key}` }],
        [{ text: '🖼 Editar imagem', callback_data: `template_edit_image_${key}` }],
        [{ text: '♻️ Restaurar padrão', callback_data: `template_reset_${key}` }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_actions_messages' }],
      ],
    },
  });
}

export async function editTemplateText(ctx: Context, key: string) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, `template_text_${key}`, 'Digite o novo texto (use variáveis):', {
    validate: async (input) => input.trim().length > 0 ? null : 'Texto vazio.',
    onSuccess: async (ctx, text) => {
      await prisma.messageTemplate.upsert({ where: { key }, update: { text }, create: { key, text } });
      await ctx.editMessage('✅ Texto atualizado.');
      await viewTemplate(ctx, key);
    },
  });
}

export async function editTemplateImage(ctx: Context, key: string) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, `template_image_${key}`, 'Envie a URL da imagem (ou "remover"):', {
    validate: async (input) => input.toLowerCase() === 'remover' ? null : (input.startsWith('http') ? null : 'URL inválida.'),
    onSuccess: async (ctx, imageUrl) => {
      const finalUrl = imageUrl.toLowerCase() === 'remover' ? null : imageUrl;
      const template = await prisma.messageTemplate.findUnique({ where: { key } });
      if (template) {
        await prisma.messageTemplate.update({ where: { key }, data: { imageUrl: finalUrl } });
      } else {
        await prisma.messageTemplate.create({ data: { key, text: '', imageUrl: finalUrl } });
      }
      await ctx.editMessage('✅ Imagem atualizada.');
      await viewTemplate(ctx, key);
    },
  });
}

export async function resetTemplate(ctx: Context, key: string) {
  if (!(await isAdmin(ctx))) return;
  await prisma.messageTemplate.deleteMany({ where: { key } });
  await ctx.editMessage('♻️ Template restaurado.');
  await viewTemplate(ctx, key);
}
