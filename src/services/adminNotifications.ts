import prisma from '../database';
import { logAction } from './logger';
import { replaceVars } from '../flows/dynamicVars';

// Eventos possíveis
type NotificationEvent = 'newUser' | 'paymentApproved' | 'saleCompleted' | 'withdrawalRequested' | 'lowStock' | 'suspiciousActivity';

// Obtém configuração de notificações
async function getNotificationConfig() {
  const setting = await prisma.setting.findUnique({ where: { key: 'admin_notifications' } });
  if (!setting) {
    return {
      newUser: true,
      paymentApproved: true,
      saleCompleted: true,
      withdrawalRequested: true,
      lowStock: true,
      suspiciousActivity: true,
    };
  }
  return setting.value as Record<NotificationEvent, boolean>;
}

// Obtém template de mensagem para um evento
async function getMessageTemplate(event: NotificationEvent, vars: Record<string, any>): Promise<string> {
  const template = await prisma.messageTemplate.findUnique({ where: { key: `notif_${event}` } });
  if (!template) {
    // Mensagens padrão
    const defaultMessages: Record<NotificationEvent, string> = {
      newUser: '👤 Novo usuário cadastrado!\nID: {userId}\nNome: {userName}',
      paymentApproved: '💰 Pagamento aprovado!\nID: {paymentId}\nUsuário: {userId}\nValor: R$ {amount}\nMétodo: {method}',
      saleCompleted: '🛒 Venda realizada!\nPedido: {orderId}\nUsuário: {userId}\nProduto: {productName}\nTotal: R$ {total}',
      withdrawalRequested: '💸 Saque solicitado!\nSaque: {withdrawalId}\nUsuário: {userId}\nValor: R$ {amount}',
      lowStock: '📦 Estoque baixo!\nProduto: {productName} (ID: {productId})\nDisponíveis: {available}',
      suspiciousActivity: '⚠️ Atividade suspeita!\nAção: {action}\nUsuário: {userId}\nDetalhes: {details}',
    };
    return replaceVars(defaultMessages[event], vars);
  }
  return replaceVars(template.text, vars);
}

// Envia notificação para todos os admins
export async function notifyAdmins(event: NotificationEvent, vars: Record<string, any>) {
  const config = await getNotificationConfig();
  if (!config[event]) return; // notificação desativada para este evento

  // Busca admins ativos
  const admins = await prisma.user.findMany({
    where: {
      role: { in: ['OWNER', 'ADMIN', 'FINANCE', 'STOCK', 'SUPPORT', 'ANALYST'] },
      status: 'ACTIVE',
    },
  });

  const message = await getMessageTemplate(event, vars);

  const bot = (await import('../bot')).default;
  for (const admin of admins) {
    try {
      await bot.telegram.sendMessage(admin.telegramId.toString(), message);
    } catch (error) {
      await logAction({ action: 'NOTIFY_ADMIN_FAILED', userId: admin.id, details: { error: String(error), event } });
    }
  }
}
