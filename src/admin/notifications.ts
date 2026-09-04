import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { logger } from '../services/logger';

// Mostra menu de configuração de notificações
export async function showNotificationConfig(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const notifConfig = await prisma.setting.findUnique({ where: { key: 'admin_notifications' } });
  const config = notifConfig?.value as any || {
    newUser: true,
    paymentApproved: true,
    saleCompleted: true,
    lowStock: true,
    withdrawalRequested: true,
    suspiciousActivity: true,
  };

  const text = `🔔 NOTIFICAÇÕES ADMINISTRATIVAS\n\n` +
    `Toque para alternar:\n` +
    `👤 Novo usuário: ${config.newUser ? '✅' : '❌'}\n` +
    `💰 Pagamento aprovado: ${config.paymentApproved ? '✅' : '❌'}\n` +
    `🛒 Venda realizada: ${config.saleCompleted ? '✅' : '❌'}\n` +
    `📦 Estoque baixo: ${config.lowStock ? '✅' : '❌'}\n` +
    `💸 Saque solicitado: ${config.withdrawalRequested ? '✅' : '❌'}\n` +
    `⚠️ Atividade suspeita: ${config.suspiciousActivity ? '✅' : '❌'}`;

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '👤 Novo usuário', callback_data: 'notif_toggle_newUser' }],
        [{ text: '💰 Pagamento', callback_data: 'notif_toggle_paymentApproved' }],
        [{ text: '🛒 Venda', callback_data: 'notif_toggle_saleCompleted' }],
        [{ text: '📦 Estoque baixo', callback_data: 'notif_toggle_lowStock' }],
        [{ text: '💸 Saque', callback_data: 'notif_toggle_withdrawalRequested' }],
        [{ text: '⚠️ Suspeita', callback_data: 'notif_toggle_suspiciousActivity' }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_config' }],
      ],
    },
  });
}

// Alterna uma configuração de notificação
export async function toggleNotification(ctx: Context, key: string) {
  if (!(await isAdmin(ctx))) return;

  const notifConfig = await prisma.setting.findUnique({ where: { key: 'admin_notifications' } });
  const config = notifConfig?.value as any || {
    newUser: true,
    paymentApproved: true,
    saleCompleted: true,
    lowStock: true,
    withdrawalRequested: true,
    suspiciousActivity: true,
  };
  config[key] = !config[key];

  await prisma.setting.upsert({
    where: { key: 'admin_notifications' },
    update: { value: config },
    create: { key: 'admin_notifications', value: config },
  });

  await showNotificationConfig(ctx);
}

// Função central para enviar notificação administrativa (usada em outros módulos)
export async function notifyAdmins(event: string, message: string) {
  // Busca configuração para saber se deve notificar
  const notifConfig = await prisma.setting.findUnique({ where: { key: 'admin_notifications' } });
  const config = notifConfig?.value as any || {
    newUser: true,
    paymentApproved: true,
    saleCompleted: true,
    lowStock: true,
    withdrawalRequested: true,
    suspiciousActivity: true,
  };

  if (!config[event]) {
    // Notificação desativada para este evento
    return;
  }

  // Busca todos os administradores
  const admins = await prisma.user.findMany({
    where: {
      role: { in: ['OWNER', 'ADMIN', 'FINANCE', 'STOCK', 'SUPPORT'] },
      status: 'ACTIVE',
    },
  });

  // Envia mensagem para cada admin (usando Telegram)
  const bot = (await import('../bot')).default;
  for (const admin of admins) {
    try {
      await bot.telegram.sendMessage(admin.telegramId.toString(), `🔔 *Notificação Admin*\n\n${message}`, {
        parse_mode: 'Markdown',
      });
    } catch (error) {
      logger.error('Falha ao enviar notificação admin', { error, adminId: admin.id });
    }
  }
}
