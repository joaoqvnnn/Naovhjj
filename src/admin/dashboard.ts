import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { formatCurrency, formatDate } from '../utils/format';

export async function showAdminDashboard(ctx: Context) {
  if (!(await isAdmin(ctx))) {
    await ctx.editMessage('⛔ Acesso negado.');
    return;
  }

  const totalUsers = await prisma.user.count();
  const totalRevenue = await prisma.payment.aggregate({
    where: { status: 'APPROVED' },
    _sum: { amount: true },
  });
  const todayRevenue = await prisma.payment.aggregate({
    where: {
      status: 'APPROVED',
      paidAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    },
    _sum: { amount: true },
  });
  const totalOrders = await prisma.order.count();
  const todayOrders = await prisma.order.count({
    where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
  });

  const text = `📊 DASHBOARD ADMINISTRATIVO\n\n` +
    `👥 Usuários: ${totalUsers}\n` +
    `💰 Receita total: ${formatCurrency(totalRevenue._sum.amount || 0)}\n` +
    `💰 Receita hoje: ${formatCurrency(todayRevenue._sum.amount || 0)}\n` +
    `🛒 Vendas totais: ${totalOrders}\n` +
    `🛒 Vendas hoje: ${todayOrders}\n\n` +
    `Selecione uma opção:`;

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📦 Produtos', callback_data: 'admin_produtos' }],
        [{ text: '👥 Usuários', callback_data: 'admin_usuarios' }],
        [{ text: '📝 Editor de Mensagens', callback_data: 'template_list' }],
        [{ text: '🔘 Editor de Botões', callback_data: 'button_list' }],
        [{ text: '⚙️ Configurações', callback_data: 'admin_config' }],
        [{ text: '📢 Transmissão', callback_data: 'broadcast_menu' }],
        [{ text: '🛡️ Anti-flood', callback_data: 'antiflood_menu' }],
        [{ text: '🔔 Notificações', callback_data: 'notif_menu' }],
        [{ text: '⏮️ Voltar', callback_data: 'voltar' }],
      ],
    },
  });
}
