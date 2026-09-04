import { Context } from '../types/context';
import { registerScreen } from './manager';
import prisma from '../database';
import { formatCurrency } from '../utils/format';
import { startCapture } from '../middlewares/capture';
import { isValidWhatsApp, normalizeWhatsApp, isValidEmail } from '../utils/format';

// Tela: Comprar (categorias)
registerScreen({
  id: 'comprar',
  render: async (ctx: Context) => {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
    });

    if (categories.length === 0) {
      return {
        text: '😕 Nenhuma categoria disponível no momento.',
        keyboard: {
          inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'voltar' }]],
        },
      };
    }

    const keyboardButtons = categories.map((cat) => [{
      text: `${cat.emoji || '📦'} ${cat.name}`,
      callback_data: `categoria_${cat.id}`,
    }]);

    keyboardButtons.push([{ text: '⏮️ Voltar', callback_data: 'voltar' }]);

    return {
      text: `📦 Selecione uma categoria:`,
      keyboard: { inline_keyboard: keyboardButtons },
    };
  },
});

// Tela: Meu Perfil
registerScreen({
  id: 'perfil',
  render: async (ctx: Context) => {
    const userId = ctx.from!.id;
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(userId) },
      include: {
        orders: true,
        payments: true,
        giftCards: true,
      },
    });

    if (!user) return { text: 'Usuário não encontrado.' };

    const totalSpent = user.orders
      .filter((o) => o.status === 'PAID' || o.status === 'DELIVERED')
      .reduce((sum, o) => sum + parseFloat(o.totalPrice.toString()), 0);

    const text = `👤 Meu Perfil\n\n` +
      `🆔 ID da Carteira: ${user.id}\n` +
      `💰 Saldo Atual: ${formatCurrency(user.balance)}\n` +
      `📲 Seu WhatsApp: ${user.whatsapp || 'Não informado'}\n\n` +
      `📊 Suas Movimentações:\n` +
      `🛒 Compras realizadas: ${user.orders.length}\n` +
      `💰 Total gasto: ${formatCurrency(totalSpent)}\n` +
      `💠 Pix inseridos: ${user.payments.filter(p => p.status === 'APPROVED').length}\n` +
      `🎁 Gifts resgatados: ${user.giftCards.length}`;

    return {
      text,
      keyboard: {
        inline_keyboard: [
          [{ text: '🛍️ Histórico de compras', callback_data: 'menu_historico' }],
          [{ text: '🎁 Resgatar Gift Card', callback_data: 'menu_giftcard' }],
          [{ text: '✏️ Alterar dados', callback_data: 'menu_alterar_dados' }],
          [{ text: '⏮️ Voltar', callback_data: 'voltar' }],
        ],
      },
    };
  },
});

// Tela: Recarregar
registerScreen({
  id: 'recarregar',
  render: async (ctx: Context) => {
    const userId = ctx.from!.id;
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(userId) },
    });

    if (!user) return { text: 'Usuário não encontrado.' };

    const minRecharge = await prisma.setting.findUnique({ where: { key: 'min_recharge' } });
    const bonusConfig = await prisma.setting.findUnique({ where: { key: 'bonus_recharge' } });

    const min = minRecharge ? parseFloat(minRecharge.value.toString()) : 4.0;
    const bonus = bonusConfig ? parseFloat(bonusConfig.value.toString()) : 0;

    return {
      text: `💰 Recarregar Saldo\n\n` +
        `🆔 ID da Carteira: ${user.id}\n` +
        `💰 Saldo Disponível: ${formatCurrency(user.balance)}\n` +
        `📍 Opte por Pix Rápido\n` +
        `🔻 Recarga mínima: ${formatCurrency(min)}\n` +
        `🎁 Bônus: ${bonus}%`,
      keyboard: {
        inline_keyboard: [
          [{ text: '💠 Pix Rápido', callback_data: 'pix_rapido' }],
          [{ text: '⏮️ Voltar', callback_data: 'voltar' }],
        ],
      },
    };
  },
});

// Tela: Afiliados
registerScreen({
  id: 'afiliados',
  render: async (ctx: Context) => {
    const userId = ctx.from!.id;
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(userId) },
    });

    if (!user) return { text: 'Usuário não encontrado.' };

    const commissionConfig = await prisma.setting.findUnique({ where: { key: 'commission_rate' } });
    const minWithdrawConfig = await prisma.setting.findUnique({ where: { key: 'min_withdraw' } });

    const rate = commissionConfig ? parseFloat(commissionConfig.value.toString()) : 10;
    const minWithdraw = minWithdrawConfig ? parseFloat(minWithdrawConfig.value.toString()) : 20;

    const referralLink = `https://t.me/larizinhastorebot?start=${userId}`;

    return {
      text: `🤝 Afiliados\n\n` +
        `💰 Comissão: ${rate}%\n` +
        `📊 Saldo de comissão: ${formatCurrency(user.affiliateBalance)}\n` +
        `🔗 Link de indicação:\n${referralLink}\n\n` +
        `Meta de saque mínimo: ${formatCurrency(minWithdraw)}`,
      keyboard: {
        inline_keyboard: [
          [{ text: '💸 Sacar', callback_data: 'menu_saque' }],
          [{ text: '📊 Extrato', callback_data: 'menu_extrato_saque' }],
          [{ text: '⏮️ Voltar', callback_data: 'voltar' }],
        ],
      },
    };
  },
});

// Tela: Histórico de compras (versão resumida, será expandida)
registerScreen({
  id: 'historico',
  render: async (ctx: Context) => {
    const userId = ctx.from!.id;
    const orders = await prisma.order.findMany({
      where: { userId: (await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } }))?.id },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    if (!orders.length) {
      return {
        text: 'Você não tem compras ativas (não vencidas) no bot.',
        keyboard: {
          inline_keyboard: [[{ text: '🛍 Ver todas as compras', callback_data: 'historico_todas' }]],
        },
      };
    }

    const text = orders.map((o, i) => (
      `${i + 1}. ${o.product.name} - ${formatCurrency(o.totalPrice)} - ${o.status}`
    )).join('\n');

    return {
      text: `🛍️ Últimas compras:\n\n${text}`,
      keyboard: {
        inline_keyboard: [
          [{ text: '⬅️ Anterior', callback_data: 'hist_prev' }, { text: 'Próxima ➡️', callback_data: 'hist_next' }],
          [{ text: '⏮️ Voltar', callback_data: 'voltar' }],
        ],
      },
    };
  },
});
