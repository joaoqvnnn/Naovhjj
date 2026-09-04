import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';
import { logAction } from '../services/logger';

const EVENT_KEYS = ['newUser', 'paymentApproved', 'saleCompleted', 'withdrawalRequested', 'lowStock', 'suspiciousActivity'];
const EVENT_LABELS: Record<string, string> = {
  newUser: 'Novo usuário',
  paymentApproved: 'Pagamento aprovado',
  saleCompleted: 'Venda realizada',
  withdrawalRequested: 'Saque solicitado',
  lowStock: 'Estoque baixo',
  suspiciousActivity: 'Atividade suspeita',
};

export async function showNotificationTemplateMenu(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const buttons = EVENT_KEYS.map(key => [{ text: `📝 ${EVENT_LABELS[key]}`, callback_data: `notiftpl_${key}` }]);
  buttons.push([{ text: '⏮️ Voltar', callback_data: 'admin_actions_notifications' }]);

  await ctx.editMessage('🔔 Notificações Administrativas\n\nEdite o template de cada evento:', {
    reply_markup: { inline_keyboard: buttons },
  });
}

export async function viewNotificationTemplate(ctx: Context, eventKey: string) {
  if (!(await isAdmin(ctx))) return;
  const template = await prisma.messageTemplate.findUnique({ where: { key: `notif_${eventKey}` } });
  const current = template?.text || 'Padrão do sistema';
  await ctx.editMessage(`Template para "${EVENT_LABELS[eventKey]}":\n\n${current}\n\nVariáveis: use {chave} para dados dinâmicos.`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '✏️ Editar', callback_data: `notiftpledit_${eventKey}` }],
        [{ text: '♻️ Restaurar padrão', callback_data: `notiftplreset_${eventKey}` }],
        [{ text: '⏮️ Voltar', callback_data: 'notiftpl_menu' }],
      ],
    },
  });
}

export async function editNotificationTemplate(ctx: Context, eventKey: string) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, `notiftpledit_${eventKey}`, 'Digite o novo texto (use variáveis):', {
    validate: async (input) => input.length > 0 ? null : 'Texto vazio.',
    onSuccess: async (ctx, text) => {
      await prisma.messageTemplate.upsert({
        where: { key: `notif_${eventKey}` },
        update: { text },
        create: { key: `notif_${eventKey}`, text },
      });
      await logAction({ action: 'NOTIF_TEMPLATE_UPDATED', details: { event: eventKey } });
      await ctx.editMessage('✅ Template atualizado.');
      await viewNotificationTemplate(ctx, eventKey);
    },
  });
}

export async function resetNotificationTemplate(ctx: Context, eventKey: string) {
  if (!(await isAdmin(ctx))) return;
  await prisma.messageTemplate.deleteMany({ where: { key: `notif_${eventKey}` } });
  await logAction({ action: 'NOTIF_TEMPLATE_RESET', details: { event: eventKey } });
  await ctx.editMessage('♻️ Template restaurado ao padrão.');
  await viewNotificationTemplate(ctx, eventKey);
}
