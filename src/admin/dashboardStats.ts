import { Context } from '../types/context';
import { getDetailedStats } from '../services/stats';
import { formatCurrency } from '../utils/format';
import { isAdmin } from './userManagement';

export async function showDetailedStats(ctx: Context) {
  if (!(await isAdmin(ctx))) return ctx.editMessage('Acesso negado.');

  const stats = await getDetailedStats();

  const text = `📊 ESTATÍSTICAS DETALHADAS\n\n` +
    `👥 Usuários totais: ${stats.totalUsers}\n` +
    `🟢 Usuários ativos: ${stats.activeUsers}\n` +
    `💰 Receita total: ${formatCurrency(stats.totalRevenue)}\n` +
    `📅 Receita mensal: ${formatCurrency(stats.monthlyRevenue)}\n` +
    `📆 Receita hoje: ${formatCurrency(stats.todayRevenue)}\n\n` +
    `🛒 Pedidos totais: ${stats.totalOrders}\n` +
    `📦 Pedidos hoje: ${stats.todayOrders}\n` +
    `⏳ Pagamentos pendentes: ${stats.pendingPayments}\n` +
    `⌛️ Pagamentos expirados: ${stats.expiredPayments}\n\n` +
    `💸 Saques pagos: ${stats.totalWithdrawals}\n` +
    `🏷️ Produtos ativos: ${stats.totalProducts}\n` +
    `📦 Unidades em estoque: ${stats.totalStockUnits}\n` +
    `⚠️ Produtos com estoque baixo: ${stats.lowStockProducts}`;

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔄 Atualizar', callback_data: 'stats_refresh' }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_dashboard' }],
      ],
    },
  });
}
