import { Context } from '../types/context';
import prisma from '../database';
import { getAdminPersonalStats } from '../services/adminPersonalStats';
import { registerScreen } from './manager';
import { formatCurrency } from '../utils/format';

registerScreen({
  id: 'admin_start',
  render: async (ctx: Context) => {
    const userId = ctx.from!.id;
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
    if (!user || user.role === 'USER') return { text: 'Acesso negado.' };

    const stats = await getAdminPersonalStats(user.id);
    if (!stats) return { text: 'Erro ao carregar estatísticas.' };

    const template = await prisma.messageTemplate.findUnique({ where: { key: 'admin_start' } });

    let text = '';
    if (template) {
      text = template.text
        .replace(/\{compras_feitas\}/g, String(stats.comprasFeitas))
        .replace(/\{giftcards_resgatados\}/g, formatCurrency(stats.giftCardsResgatados))
        .replace(/\{link_afiliado\}/g, stats.referralLink)
        .replace(/\{quantidade_afiliados\}/g, String(stats.affiliateCount))
        .replace(/\{pontos_indicacao\}/g, String(stats.affiliatePoints));
    } else {
      text = `LOGINS | CONTAS PREMIUM\n\n` +
        `Compras feitas: ${stats.comprasFeitas}\n` +
        `GiftCard's resgatados: ${formatCurrency(stats.giftCardsResgatados)}\n\n` +
        `Área afiliados\n` +
        `Seu link de afiliado:\n${stats.referralLink}\n` +
        `Quantidade de afiliados: ${stats.affiliateCount}\n` +
        `Pontos de indicação: ${stats.affiliatePoints}\n\n` +
        `Escolha uma opção:`;
    }

    const keyboard = {
      inline_keyboard: [
        [{ text: '📦 LOGINS | CONTAS PREMIUM', callback_data: 'admin_menu_config' }],
        [{ text: '👤 PERFIL', callback_data: 'menu_perfil' }],
        [{ text: '💰 ADICIONAR SALDO', callback_data: 'menu_recarregar' }],
        [{ text: '🆘 SUPORTE', callback_data: 'menu_suporte' }],
        [{ text: '🤖 ALUGAR BOT', callback_data: 'admin_rent_bot' }],
        [{ text: '🔎 PESQUISAR SERVICO', callback_data: 'menu_pesquisar' }],
        [{ text: '⚙️ PAINEL ADMIN', callback_data: 'admin_dashboard' }],
      ],
    };

    const imageUrl = template?.imageUrl;
    if (imageUrl) {
      const sent = await ctx.replyWithPhoto(imageUrl, {
        caption: text,
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      if (sent.message_id) {
        ctx.session.messageIdToEdit = sent.message_id;
        ctx.session.chatId = ctx.chat!.id;
      }
      return { text: '', keyboard: undefined };
    }

    return { text, keyboard };
  },
});
