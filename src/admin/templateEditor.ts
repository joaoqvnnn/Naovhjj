import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';
import { logAction } from '../services/logger';

// Lista de templates disponíveis (keys)
const TEMPLATE_KEYS = [
  'start',
  'perfil',
  'produto',
  'categoria',
  'saldo_insuficiente',
  'pix',
  'pix_expirado',
  'pagamento_aprovado',
  'compra_aprovada',
  'entrega',
  'historico',
  'afiliados',
  'saque',
  'giftcard',
  'alerta',
  'ranking',
  'manutencao',
  'erro',
  'email_compra',
  'whatsapp_compra',
];

// Mostra lista de templates disponíveis
export async function showTemplateList(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const buttons = TEMPLATE_KEYS.map(key => [{
    text: `📝 ${key}`,
    callback_data: `template_view_${key}`,
  }]);

  buttons.push([{ text: '⏮️ Voltar', callback_data: 'admin_config' }]);

  await ctx.editMessage(
    `📝 EDITOR DE MENSAGENS\n\nSelecione o template para editar:`,
    { reply_markup: { inline_keyboard: buttons } }
  );
}

// Mostra detalhes de um template específico
export async function viewTemplate(ctx: Context, key: string) {
  if (!(await isAdmin(ctx))) return;

  const template = await prisma.messageTemplate.findUnique({
    where: { key },
  });

  const text = template?.text || 'Não personalizado. Usa padrão do sistema.';
  const imageUrl = template?.imageUrl || 'Sem imagem';

  await ctx.editMessage(
    `📝 Template: ${key}\n\n` +
    `📄 Texto atual:\n\n${text}\n\n` +
    `🖼 Imagem: ${imageUrl}\n\n` +
    `O que deseja fazer?`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✏️ Editar texto', callback_data: `template_edit_text_${key}` }],
          [{ text: '🖼 Editar imagem', callback_data: `template_edit_image_${key}` }],
          [{ text: '♻️ Restaurar padrão', callback_data: `template_reset_${key}` }],
          [{ text: '⏮️ Voltar', callback_data: 'template_list' }],
        ],
      },
    }
  );
}

// Inicia edição de texto do template
export async function editTemplateText(ctx: Context, key: string) {
  if (!(await isAdmin(ctx))) return;

  await startCapture(ctx, `template_text_${key}`, 'Digite o novo texto do template (use variáveis como {saldo}, {produto}, etc.):', {
    validate: async (input) => {
      if (input.length > 4000) return '❌ Texto muito longo (máx. 4000 caracteres).';
      return null;
    },
    onSuccess: async (ctx, text) => {
      await prisma.messageTemplate.upsert({
        where: { key },
        update: { text },
        create: { key, text },
      });
      await logAction({ action: 'TEMPLATE_TEXT_UPDATED', details: { key, by: ctx.from?.id } });
      await ctx.editMessage(`✅ Texto do template "${key}" atualizado com sucesso.`);
      await viewTemplate(ctx, key);
    },
  });
}

// Inicia edição de imagem do template (captura URL)
export async function editTemplateImage(ctx: Context, key: string) {
  if (!(await isAdmin(ctx))) return;

  await startCapture(ctx, `template_image_${key}`, 'Envie a URL da imagem (ou "remover" para tirar):', {
    validate: async (input) => {
      if (input.toLowerCase() === 'remover') return null;
      if (!/^https?:\/\/.+/.test(input)) return '❌ URL inválida.';
      return null;
    },
    onSuccess: async (ctx, imageUrl) => {
      const finalUrl = imageUrl.toLowerCase() === 'remover' ? null : imageUrl;
      const template = await prisma.messageTemplate.findUnique({ where: { key } });
      if (template) {
        await prisma.messageTemplate.update({
          where: { key },
          data: { imageUrl: finalUrl },
        });
      } else {
        await prisma.messageTemplate.create({
          data: { key, text: '', imageUrl: finalUrl },
        });
      }
      await logAction({ action: 'TEMPLATE_IMAGE_UPDATED', details: { key, by: ctx.from?.id } });
      await ctx.editMessage(`✅ Imagem do template "${key}" atualizada.`);
      await viewTemplate(ctx, key);
    },
  });
}

// Restaura template para padrão (remove customização)
export async function resetTemplate(ctx: Context, key: string) {
  if (!(await isAdmin(ctx))) return;

  await prisma.messageTemplate.deleteMany({ where: { key } });
  await logAction({ action: 'TEMPLATE_RESET', details: { key, by: ctx.from?.id } });
  await ctx.editMessage(`♻️ Template "${key}" restaurado ao padrão.`);
  await viewTemplate(ctx, key);
}
