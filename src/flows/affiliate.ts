import { Context } from '../types/context';
import prisma from '../database';
import { formatCurrency } from '../utils/format';

export async function showAfiliadosMenu(ctx: Context) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });

  if (!user) return ctx.editMessageText('Usuário não encontrado.');

  const botInfo = await ctx.telegram.getMe();
  const referralLink = `https://t.me/${botInfo.username}?start=${userId}`;

  await ctx.editMessageText(
    `🤝 Afiliados\n\n` +
    `Saldo de comissões: ${formatCurrency(user.affiliateBalance)}\n\n` +
    `Seu link de indicação:\n${referralLink}`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💸 Sacar', callback_data: 'saque_menu' }],
          [{ text: '📊 Histórico de saques', callback_data: 'saque_historico' }],
          [{ text: '⏮️ Voltar', callback_data: 'voltar_inicio' }],
        ],
      },
    }
  );
}
