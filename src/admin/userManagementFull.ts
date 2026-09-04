import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';
import { formatCurrency, formatDate } from '../utils/format';
import { logAction } from '../services/logger';

// Lista usuários com paginação simples
export async function listUsers(ctx: Context, page: number = 0) {
  if (!(await isAdmin(ctx))) return;

  const perPage = 10;
  const total = await prisma.user.count();
  const users = await prisma.user.findMany({
    orderBy: { id: 'desc' },
    skip: page * perPage,
    take: perPage,
    select: { id: true, telegramId: true, username: true, balance: true, status: true },
  });

  const totalPages = Math.ceil(total / perPage) || 1;
  let text = `👥 USUÁRIOS (página ${page + 1}/${totalPages})\n\n`;
  users.forEach(u => {
    text += `#${u.id} | ${u.username || u.telegramId} | ${formatCurrency(u.balance)} | ${u.status}\n`;
  });

  const buttons = [];
  const navButtons = [];
  if (page > 0) navButtons.push({ text: '⬅️ Anterior', callback_data: `users_page_${page - 1}` });
  if (page < totalPages - 1) navButtons.push({ text: 'Próxima ➡️', callback_data: `users_page_${page + 1}` });
  if (navButtons.length) buttons.push(navButtons);

  // Botão para pesquisar usuário
  buttons.push([{ text: '🔍 Pesquisar usuário', callback_data: 'users_search' }]);
  buttons.push([{ text: '⏮️ Voltar', callback_data: 'admin_config_users' }]);

  await ctx.editMessage(text, {
    reply_markup: { inline_keyboard: buttons },
  });
}

// Pesquisa usuário por ID, Telegram ID ou username
export async function searchUser(ctx: Context, term: string) {
  if (!(await isAdmin(ctx))) return;

  let user = null;
  if (/^\d+$/.test(term)) {
    const num = parseInt(term);
    user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: num },
          { telegramId: BigInt(num) },
        ],
      },
    });
  } else {
    user = await prisma.user.findFirst({
      where: { username: { contains: term, mode: 'insensitive' } },
    });
  }

  if (!user) {
    await ctx.editMessage(`❌ Nenhum usuário encontrado para "${term}".`, {
      reply_markup: { inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'users_menu' }]] },
    });
    return;
  }

  await viewUserDetails(ctx, user.id);
}

// Mostra menu principal de usuários
export async function showUsersMenu(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await ctx.editMessage('👥 GERENCIAR USUÁRIOS\n\nEscolha uma ação:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📋 Listar usuários', callback_data: 'users_list' }],
        [{ text: '🔍 Pesquisar', callback_data: 'users_search' }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_menu_config' }],
      ],
    },
  });
}

// Visualiza detalhes de um usuário
export async function viewUserDetails(ctx: Context, userId: number) {
  if (!(await isAdmin(ctx))) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      orders: { orderBy: { createdAt: 'desc' }, take: 5, include: { product: true } },
      withdrawals: { orderBy: { createdAt: 'desc' }, take: 5 },
      giftCards: { where: { usedByUserId: userId } },
    },
  });

  if (!user) return ctx.editMessage('Usuário não encontrado.');

  const totalSpent = user.orders
    .filter(o => o.status === 'PAID' || o.status === 'DELIVERED')
    .reduce((acc, o) => acc + parseFloat(o.totalPrice.toString()), 0);

  const text = `👤 Usuário #${user.id}\n\n` +
    `Telegram ID: ${user.telegramId}\n` +
    `Username: @${user.username || 'N/A'}\n` +
    `Nome: ${user.firstName || 'N/A'} ${user.lastName || ''}\n` +
    `Email: ${user.email || 'N/A'}\n` +
    `WhatsApp: ${user.whatsapp || 'N/A'}\n` +
    `Status: ${user.status}\n` +
    `Role: ${user.role}\n\n` +
    `💰 Saldo: ${formatCurrency(user.balance)}\n` +
    `🤝 Saldo afiliado: ${formatCurrency(user.affiliateBalance)}\n` +
    `🛒 Compras: ${user.orders.length}\n` +
    `💵 Total gasto: ${formatCurrency(totalSpent)}\n` +
    `🎁 Gift cards resgatados: ${user.giftCards.length}\n\n` +
    `Últimas compras:\n` +
    (user.orders.length ? user.orders.map(o => `- ${o.product.name} (${o.status}) - ${formatCurrency(o.totalPrice)}`).join('\n') : 'Nenhuma') + '\n\n' +
    `Saques solicitados: ${user.withdrawals.length}`;

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💰 Ajustar saldo', callback_data: `user_edit_balance_${user.id}` }],
        [{ text: user.status === 'BLOCKED' ? '🔓 Desbloquear' : '🔒 Bloquear', callback_data: `user_toggle_block_${user.id}` }],
        [{ text: '📄 Gerar PDF histórico', callback_data: `user_pdf_${user.id}` }],
        [{ text: '📨 Enviar mensagem', callback_data: `user_message_${user.id}` }],
        [{ text: '⏮️ Voltar', callback_data: 'users_list' }],
      ],
    },
  });
}

// Ajusta saldo do usuário
export async function editUserBalance(ctx: Context, userId: number) {
  if (!(await isAdmin(ctx))) return;

  await startCapture(ctx, `user_balance_${userId}`, 'Digite o novo saldo (ex: 100.00) ou ajuste relativo (+50 ou -30):', {
    validate: async (input) => {
      if (!/^[+-]?\d+(\.\d{1,2})?$/.test(input)) return 'Formato inválido.';
      return null;
    },
    onSuccess: async (ctx, value) => {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return ctx.editMessage('Usuário não encontrado.');

      const num = parseFloat(value.replace(',', '.'));

      if (value.startsWith('+')) {
        await prisma.user.update({ where: { id: userId }, data: { balance: { increment: num } } });
      } else if (value.startsWith('-')) {
        const abs = Math.abs(num);
        if (parseFloat(user.balance.toString()) < abs) return ctx.editMessage('Saldo insuficiente para decrementar.');
        await prisma.user.update({ where: { id: userId }, data: { balance: { decrement: abs } } });
      } else {
        await prisma.user.update({ where: { id: userId }, data: { balance: num } });
      }

      await logAction({ action: 'BALANCE_ADJUSTED', userId, details: { by: ctx.from?.id, value } });
      await ctx.editMessage('✅ Saldo atualizado.');
      await viewUserDetails(ctx, userId);
    },
  });
}

// Alterna bloqueio do usuário
export async function toggleUserBlock(ctx: Context, userId: number) {
  if (!(await isAdmin(ctx))) return;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return ctx.editMessage('Usuário não encontrado.');

  const newStatus = user.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED';
  await prisma.user.update({ where: { id: userId }, data: { status: newStatus } });
  await logAction({ action: newStatus === 'BLOCKED' ? 'USER_BLOCKED' : 'USER_UNBLOCKED', userId, details: { by: ctx.from?.id } });
  await ctx.editMessage(`✅ Usuário ${newStatus === 'BLOCKED' ? 'bloqueado' : 'desbloqueado'}.`);
  await viewUserDetails(ctx, userId);
}

// Envia mensagem individual para o usuário
export async function sendMessageToUser(ctx: Context, userId: number) {
  if (!(await isAdmin(ctx))) return;

  await startCapture(ctx, `user_msg_${userId}`, 'Digite a mensagem a ser enviada:', {
    validate: async (input) => input.trim().length > 0 ? null : 'Mensagem vazia.',
    onSuccess: async (ctx, text) => {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return ctx.editMessage('Usuário não encontrado.');

      const bot = (await import('../bot')).default;
      await bot.telegram.sendMessage(user.telegramId.toString(), text);
      await logAction({ action: 'ADMIN_MESSAGE_SENT', userId, details: { by: ctx.from?.id, text } });
      await ctx.editMessage('✅ Mensagem enviada.');
    },
  });
}
