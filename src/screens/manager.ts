import { Context } from '../types/context';
import prisma from '../database';

interface ScreenDefinition {
  id: string;
  render: (ctx: Context, data?: any) => Promise<{
    text: string;
    keyboard?: any;
    imageUrl?: string;
  }>;
}

const screens = new Map<string, ScreenDefinition>();

export function registerScreen(screen: ScreenDefinition) {
  screens.set(screen.id, screen);
}

export function getScreen(id: string): ScreenDefinition | undefined {
  return screens.get(id);
}

export async function goToScreen(ctx: Context, screenId: string, data?: any) {
  const screen = getScreen(screenId);
  if (!screen) {
    console.error(`Tela não encontrada: ${screenId}`);
    return;
  }

  const result = await screen.render(ctx, data);

  if (ctx.session.messageIdToEdit && ctx.session.chatId) {
    try {
      await ctx.telegram.editMessageText(
        ctx.session.chatId,
        ctx.session.messageIdToEdit,
        undefined,
        result.text,
        result.keyboard ? { reply_markup: result.keyboard } : undefined
      );
    } catch (error: any) {
      if (error.response?.error_code === 400) {
        const sent = await ctx.reply(result.text, result.keyboard ? { reply_markup: result.keyboard } : {});
        if (sent.message_id) {
          ctx.session.messageIdToEdit = sent.message_id;
          ctx.session.chatId = ctx.chat!.id;
        }
      } else {
        console.error('Erro ao editar mensagem:', error);
      }
    }
  } else {
    const sent = await ctx.reply(result.text, result.keyboard ? { reply_markup: result.keyboard } : {});
    if (sent.message_id) {
      ctx.session.messageIdToEdit = sent.message_id;
      ctx.session.chatId = ctx.chat!.id;
    }
  }

  ctx.session.previousScreen = ctx.session.currentScreen;
  ctx.session.currentScreen = screenId;
  ctx.session.data = data || {};
}

export async function goBack(ctx: Context) {
  const previous = ctx.session.previousScreen;
  if (previous) {
    await goToScreen(ctx, previous, ctx.session.data);
  } else {
    await goToScreen(ctx, 'start');
  }
}

export function attachScreenManager(ctx: Context, next: () => Promise<void>) {
  ctx.session = ctx.session || { data: {} };
  ctx.goToScreen = (screenId, data) => goToScreen(ctx, screenId, data);
  ctx.goBack = () => goBack(ctx);
  return next();
}

// ==========================
// TELAS REGISTRADAS
// ==========================

registerScreen({
  id: 'start',
  render: async (ctx: Context) => {
    const userId = ctx.from!.id;
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });

    return {
      text: `🎬 Bem-vindo à Larizinha Store!\n\n` +
        `💠 Seus Dados:\n` +
        `├ 👤 ID: ${userId}\n` +
        `└ 💰 Saldo: R$ ${user?.balance.toString() || '0'}`,
      keyboard: {
        inline_keyboard: [
          [{ text: '🛍️ Comprar Produtos', callback_data: 'menu_comprar' }],
          [{ text: '👤 Meu Perfil', callback_data: 'menu_perfil' }],
          [{ text: '💰 Recarregar', callback_data: 'menu_recarregar' }],
          [{ text: '🤝 Afiliados', callback_data: 'menu_afiliados' }],
          [{ text: '🏆 Ranking', callback_data: 'menu_ranking' }],
          [{ text: 'ℹ️ Sobre', callback_data: 'menu_sobre' }],
        ],
      },
    };
  },
});

registerScreen({
  id: 'comprar',
  render: async (ctx: Context) => {
    const userId = ctx.from!.id;
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
    const categories = await prisma.category.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } });

    let text = `📱 Catálogo de Serviços\n\n` +
      `💰 Saldo da Carteira: R$ ${user?.balance.toString() || '0'}\n\n` +
      `Selecione uma categoria:`;

    const buttons = categories.map(cat => [{
      text: `${cat.emoji || '📦'} ${cat.name}`,
      callback_data: `categoria_${cat.id}`,
    }]);

    buttons.push([{ text: '⏮️ Voltar', callback_data: 'voltar_inicio' }]);

    return {
      text,
      keyboard: { inline_keyboard: buttons },
    };
  },
});

registerScreen({
  id: 'perfil',
  render: async (ctx: Context) => {
    const userId = ctx.from!.id;
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(userId) },
      include: { orders: true, payments: true },
    });

    if (!user) return { text: 'Usuário não encontrado.' };

    const totalSpent = user.orders
      .filter(o => o.status === 'PAID' || o.status === 'DELIVERED')
      .reduce((acc, o) => acc + parseFloat(o.totalPrice.toString()), 0);

    return {
      text: `👤 Meu Perfil\n\n` +
        `🆔 ID: ${user.telegramId}\n` +
        `💰 Saldo: R$ ${user.balance.toString()}\n` +
        `📲 WhatsApp: ${user.whatsapp || 'Não informado'}\n\n` +
        `📊 Movimentações:\n` +
        `🛒 Compras: ${user.orders.length}\n` +
        `💵 Total gasto: R$ ${totalSpent.toFixed(2)}\n` +
        `💠 Pix inseridos: ${user.payments.filter(p => p.status === 'APPROVED').length}`,
      keyboard: {
        inline_keyboard: [
          [{ text: '🛍 Histórico de compras', callback_data: 'menu_historico' }],
          [{ text: '🎁 Resgatar Gift Card', callback_data: 'menu_giftcard' }],
          [{ text: '✏️ Alterar dados', callback_data: 'menu_alterar_dados' }],
          [{ text: '⏮️ Voltar', callback_data: 'voltar_inicio' }],
        ],
      },
    };
  },
});

registerScreen({
  id: 'recarregar',
  render: async (ctx: Context) => {
    const userId = ctx.from!.id;
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });

    return {
      text: `💰 Recarregar Saldo\n\n` +
        `Seu saldo: R$ ${user?.balance.toString() || '0'}\n\n` +
        `Clique abaixo para gerar um Pix.`,
      keyboard: {
        inline_keyboard: [
          [{ text: '💠 Pix Rápido', callback_data: 'pix_rapido' }],
          [{ text: '⏮️ Voltar', callback_data: 'voltar_inicio' }],
        ],
      },
    };
  },
});

registerScreen({
  id: 'afiliados',
  render: async (ctx: Context) => {
    const userId = ctx.from!.id;
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
    const botInfo = await ctx.telegram.getMe();
    const referralLink = `https://t.me/${botInfo.username}?start=${userId}`;

    return {
      text: `🤝 Afiliados\n\n` +
        `Saldo de comissões: R$ ${user?.affiliateBalance.toString() || '0'}\n\n` +
        `Seu link:\n${referralLink}`,
      keyboard: {
        inline_keyboard: [
          [{ text: '💸 Sacar', callback_data: 'saque_menu' }],
          [{ text: '📊 Histórico de saques', callback_data: 'saque_historico' }],
          [{ text: '⏮️ Voltar', callback_data: 'voltar_inicio' }],
        ],
      },
    };
  },
});

registerScreen({
  id: 'ranking',
  render: async (ctx: Context) => {
    return {
      text: `🏆 Rankings\n\nEscolha uma opção:`,
      keyboard: {
        inline_keyboard: [
          [{ text: '📦 Serviços', callback_data: 'rank_servicos' }],
          [{ text: '💰 Recargas', callback_data: 'rank_recargas' }],
          [{ text: '💎 Saldo', callback_data: 'rank_saldo' }],
          [{ text: '🛒 Compras', callback_data: 'rank_compras' }],
          [{ text: '⏮️ Voltar', callback_data: 'voltar_inicio' }],
        ],
      },
    };
  },
});

registerScreen({
  id: 'admin_start',
  render: async (ctx: Context) => {
    const userId = ctx.from!.id;
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
    if (!user || user.role === 'USER') return { text: 'Acesso negado.' };

    return {
      text: `Painel Admin\n\nBem-vindo, ${user.username || 'Admin'}!`,
      keyboard: {
        inline_keyboard: [
          [{ text: '📊 Dashboard', callback_data: 'admin_dashboard' }],
          [{ text: '⚙️ Configurações', callback_data: 'admin_menu_config' }],
          [{ text: '📦 Produtos', callback_data: 'admin_config_products' }],
          [{ text: '👥 Usuários', callback_data: 'admin_config_users' }],
          [{ text: '⏮️ Voltar', callback_data: 'voltar_inicio' }],
        ],
      },
    };
  },
});
