import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';

export async function showNotificationConfig(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const setting = await prisma.setting.findUnique({ where: { key: 'admin_notifications' } });
  const config = setting?.value as any || {
    newUser: true,
    paymentApproved: true,
    saleCompleted: true,
    lowStock: true,
    withdrawalRequested: true,
    suspiciousActivity: true,
  };

  const text = `🔔 Notificações Administrativas\n\n` +
    `Novo usuário: ${config.newUser ? '✅' : '❌'}\n` +
    `Pagamento aprovado: ${config.paymentApproved ? '✅' : '❌'}\n` +
    `Venda realizada: ${config.saleCompleted ? '✅' : '❌'}\n` +
    `Estoque baixo: ${config.lowStock ? '✅' : '❌'}\n` +
    `Saque solicitado: ${config.withdrawalRequested ? '✅' : '❌'}\n` +
    `Atividade suspeita: ${config.suspiciousActivity ? '✅' : '❌'}`;

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '👤 Novo usuário', callback_data: 'notif_toggle_newUser' }],
        [{ text: '💰 Pagamento', callback_data: 'notif_toggle_paymentApproved' }],
        [{ text: '🛒 Venda', callback_data: 'notif_toggle_saleCompleted' }],
        [{ text: '📦 Estoque baixo', callback_data: 'notif_toggle_lowStock' }],
        [{ text: '💸 Saque', callback_data: 'notif_toggle_withdrawalRequested' }],
        [{ text: '⚠️ Suspeita', callback_data: 'notif_toggle_suspiciousActivity' }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_menu_actions' }],
      ],
    },
  });
}

export async function toggleNotification(ctx: Context, key: string) {
  if (!(await isAdmin(ctx))) return;
  const setting = await prisma.setting.findUnique({ where: { key: 'admin_notifications' } });
  const config = setting?.value as any || {};
  config[key] = !config[key];
  await prisma.setting.upsert({ where: { key: 'admin_notifications' }, update: { value: config }, create: { key: 'admin_notifications', value: config } });
  await ctx.editMessage('✅ Preferência atualizada.');
  await showNotificationConfig(ctx);
}
