import { Context } from '../types/context';
import prisma from '../database';
import { formatCurrency } from '../utils/format';
import { getAffiliateLink } from '../utils/referral';

export async function showAffiliateScreen(ctx: Context) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(userId) },
  });

  if (!user) return ctx.editMessage('Usuário não encontrado.');

  const commissionRate = await prisma.setting.findUnique({ where: { key: 'commission_rate' } });
  const minWithdraw = await prisma.setting.findUnique({ where: { key: 'min_withdraw' } });

  const rate = commissionRate ? parseFloat(commissionRate.value.toString()) : 10;
  const min = minWithdraw ? parseFloat(minWithdraw.value.toString()) : 20;

  const referralLink = await getAffiliateLink(user.id);

  const text = `💰 PROGRAMA DE AFILIADOS\n\n` +
    `⚙️ Status: Ativo\n` +
    `🧲 Sua comissão: ${rate}% (de todas recargas do indicado)\n\n` +
    `👥 Indicações: ${user.referredUsers.length || 0}\n` +
    `🪙 Total ganho: ${formatCurrency(user.affiliateBalance)}\n` +
    `📊 Média: ${formatCurrency(0)}\n` +
    `💰 Saque mínimo: ${formatCurrency(min)}\n\n` +
    `🔥 Saldo de comissões: ${formatCurrency(user.affiliateBalance)}\n\n` +
    `🌱 Nível: Iniciante\n` +
    `🎯 Próxima meta: 5 (5 restantes)\n\n` +
    `ℹ️ INFO: Seus indicados continuarão gerando comissão para sempre.\n` +
    `A comissão pode ser alterada a qualquer momento, fique atento aos avisos.\n\n` +
    `🔗 Seu link:\n${referralLink}`;

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💸 Sacar', callback_data: 'saque_menu' }],
        [{ text: '📊 Histórico de saques', callback_data: 'saque_historico' }],
        [{ text: '💠 Pontos', callback_data: 'menu_pontos' }],
        [{ text: '⏮️ Voltar', callback_data: 'voltar_inicio' }],
      ],
    },
  });
}
