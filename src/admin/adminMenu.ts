import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { formatCurrency } from '../utils/format';

export async function showAdminDashboard(ctx: Context) {
  if (!(await isAdmin(ctx))) return ctx.editMessage('⛔ Acesso negado.');

  const totalUsers = await prisma.user.count();
  const totalRevenue = await prisma.payment.aggregate({ where: { status: 'APPROVED' }, _sum: { amount: true } });
  const todayRevenue = await prisma.payment.aggregate({
    where: { status: 'APPROVED', paidAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    _sum: { amount: true },
  });
  const totalOrders = await prisma.order.count();
  const todayOrders = await prisma.order.count({ where: { createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } });

  const text = `📊 DASHBOARD\n\n` +
    `👥 Users: ${totalUsers}\n` +
    `💰 Receita total: ${formatCurrency(totalRevenue._sum.amount || 0)}\n` +
    `💰 Receita hoje: ${formatCurrency(todayRevenue._sum.amount || 0)}\n` +
    `🛒 Vendas totais: ${totalOrders}\n` +
    `🛒 Vendas hoje: ${todayOrders}\n\n` +
    `Use os botões abaixo.`;

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '⚙️ CONFIGURAÇÕES', callback_data: 'admin_menu_config' }],
        [{ text: '🛠️ AÇÕES', callback_data: 'admin_menu_actions' }],
        [{ text: '💳 TRANSAÇÕES', callback_data: 'admin_menu_transactions' }],
        [{ text: '🔄 ATUALIZAÇÕES', callback_data: 'admin_menu_updates' }],
        [{ text: '⏮️ Voltar', callback_data: 'voltar_inicio' }],
      ],
    },
  });
}

export async function showConfigMenu(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await ctx.editMessage('⚙️ MENU DE CONFIGURAÇÕES\n\nEscolha uma opção:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🛠️ Configurações Gerais', callback_data: 'admin_config_general' }],
        [{ text: '👑 Configurar Admins', callback_data: 'admin_config_admins' }],
        [{ text: '🤝 Configurar Afiliados', callback_data: 'admin_config_affiliates' }],
        [{ text: '👥 Configurar Usuários', callback_data: 'admin_config_users' }],
        [{ text: '💳 Configurar Pix', callback_data: 'admin_config_pix' }],
        [{ text: '📦 Configurar Logins', callback_data: 'admin_config_logins' }],
        [{ text: '🔎 Configurar Pesquisa', callback_data: 'admin_config_search' }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_dashboard' }],
      ],
    },
  });
}

export async function showActionsMenu(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await ctx.editMessage('🛠️ MENU DE AÇÕES\n\nEscolha uma ação:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📝 Editor de Mensagens', callback_data: 'admin_actions_messages' }],
        [{ text: '🔘 Editor de Botões', callback_data: 'admin_actions_buttons' }],
        [{ text: '📢 Transmissão', callback_data: 'admin_actions_broadcast' }],
        [{ text: '🛡️ Anti-Flood', callback_data: 'admin_actions_antiflood' }],
        [{ text: '🔔 Notificações', callback_data: 'admin_actions_notifications' }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_dashboard' }],
      ],
    },
  });
}

export async function showTransactionsMenu(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await ctx.editMessage('💳 MENU DE TRANSAÇÕES\n\nEscolha uma opção:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💸 Saques Pendentes', callback_data: 'admin_transactions_withdrawals' }],
        [{ text: '💠 Pix Manuais Pendentes', callback_data: 'admin_transactions_pix_manual' }],
        [{ text: '📊 Estatísticas', callback_data: 'admin_transactions_stats' }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_dashboard' }],
      ],
    },
  });
}

export async function showUpdatesMenu(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await ctx.editMessage('🔄 MENU DE ATUALIZAÇÕES\n\nEscolha uma opção:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔄 Verificar Atualizações', callback_data: 'admin_updates_check' }],
        [{ text: '📜 Logs do Sistema', callback_data: 'admin_updates_logs' }],
        [{ text: '🧹 Limpar Dados', callback_data: 'admin_updates_clean' }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_dashboard' }],
      ],
    },
  });
}
