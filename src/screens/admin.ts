import { Context } from '../types/context';
import { registerScreen } from './manager';
import prisma from '../database';
import { formatCurrency, formatDate } from '../utils/format';

// Função auxiliar para verificar se usuário é admin
async function isAdmin(ctx: Context): Promise<boolean> {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
  return user?.role !== 'USER' && user?.role !== undefined;
}

// Dashboard administrativo
registerScreen({
  id: 'admin_dashboard',
  render: async (ctx: Context) => {
    if (!(await isAdmin(ctx))) {
      return { text: '⛔ Acesso negado.' };
    }

    const totalUsers = await prisma.user.count();
    const totalRevenue = await prisma.payment.aggregate({
      where: { status: 'APPROVED' },
      _sum: { amount: true },
    });
    const todayRevenue = await prisma.payment.aggregate({
      where: {
        status: 'APPROVED',
        paidAt: { gte: new Date(new Date().setHours(0,0,0,0)) },
      },
      _sum: { amount: true },
    });
    const totalOrders = await prisma.order.count();
    const todayOrders = await prisma.order.count({
      where: { createdAt: { gte: new Date(new Date().setHours(0,0,0,0)) } },
    });

    return {
      text: `📊 DASHBOARD\n\n` +
        `👥 Usuários: ${totalUsers}\n` +
        `💰 Receita total: ${formatCurrency(totalRevenue._sum.amount || 0)}\n` +
        `💰 Receita hoje: ${formatCurrency(todayRevenue._sum.amount || 0)}\n` +
        `🛒 Vendas totais: ${totalOrders}\n` +
        `🛒 Vendas hoje: ${todayOrders}\n\n` +
        `Selecione uma opção:`,
      keyboard: {
        inline_keyboard: [
          [{ text: '⚙️ Configurações', callback_data: 'admin_config' }],
          [{ text: '📦 Produtos', callback_data: 'admin_produtos' }],
          [{ text: '👥 Usuários', callback_data: 'admin_usuarios' }],
          [{ text: '📢 Transmissão', callback_data: 'admin_transmissao' }],
          [{ text: '🔙 Voltar', callback_data: 'voltar' }],
        ],
      },
    };
  },
});

// Menu de configurações
registerScreen({
  id: 'admin_config',
  render: async (ctx: Context) => {
    if (!(await isAdmin(ctx))) return { text: '⛔ Acesso negado.' };
    return {
      text: `⚙️ CONFIGURAÇÕES\n\nEscolha uma opção:`,
      keyboard: {
        inline_keyboard: [
          [{ text: '💰 Pix', callback_data: 'admin_config_pix' }],
          [{ text: '🎁 Bônus', callback_data: 'admin_config_bonus' }],
          [{ text: '📝 Mensagens', callback_data: 'admin_editor' }],
          [{ text: '🔙 Voltar', callback_data: 'admin_dashboard' }],
        ],
      },
    };
  },
});

// Menu de produtos (administração)
registerScreen({
  id: 'admin_produtos',
  render: async (ctx: Context) => {
    if (!(await isAdmin(ctx))) return { text: '⛔ Acesso negado.' };
    const produtos = await prisma.product.findMany({ take: 10, orderBy: { id: 'desc' } });
    const lista = produtos.map(p => `#${p.id} - ${p.name} - ${formatCurrency(p.price)}`).join('\n') || 'Nenhum produto.';
    return {
      text: `📦 PRODUTOS\n\n${lista}\n\nAções:`,
      keyboard: {
        inline_keyboard: [
          [{ text: '➕ Adicionar Produto', callback_data: 'admin_produto_add' }],
          [{ text: '✏️ Editar Produto', callback_data: 'admin_produto_edit' }],
          [{ text: '🗂 Categorias', callback_data: 'admin_categorias' }],
          [{ text: '🔙 Voltar', callback_data: 'admin_dashboard' }],
        ],
      },
    };
  },
});

// Menu de usuários
registerScreen({
  id: 'admin_usuarios',
  render: async (ctx: Context) => {
    if (!(await isAdmin(ctx))) return { text: '⛔ Acesso negado.' };
    const usuarios = await prisma.user.findMany({ take: 10, orderBy: { id: 'desc' } });
    const lista = usuarios.map(u => `#${u.id} - ${u.username || u.firstName || 'Sem nome'} - Saldo: ${formatCurrency(u.balance)}`).join('\n') || 'Nenhum usuário.';
    return {
      text: `👥 USUÁRIOS\n\n${lista}\n\nAções:`,
      keyboard: {
        inline_keyboard: [
          [{ text: '🔍 Pesquisar Usuário', callback_data: 'admin_usuario_pesquisar' }],
          [{ text: '🔙 Voltar', callback_data: 'admin_dashboard' }],
        ],
      },
    };
  },
});

// Placeholder para transmissão (pode ser expandido)
registerScreen({
  id: 'admin_transmissao',
  render: async (ctx: Context) => {
    if (!(await isAdmin(ctx))) return { text: '⛔ Acesso negado.' };
    return {
      text: `📢 TRANSMISSÃO\n\nEnvie mensagem para segmentos de usuários. Em breve...`,
      keyboard: {
        inline_keyboard: [
          [{ text: '🔙 Voltar', callback_data: 'admin_dashboard' }],
        ],
      },
    };
  },
});
