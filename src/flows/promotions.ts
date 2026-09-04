import { Context } from '../types/context';
import prisma from '../database';
import { activateCouponForUser, redeemCoupon } from '../services/coupons';
import { logAction } from '../services/logger';

// Ativa cupom para o usuário (quando clica no botão)
export async function handleActivateCoupon(ctx: Context, couponPromotionId: number) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });

  if (!user) return;

  try {
    const code = await activateCouponForUser(user.id, couponPromotionId);

    await ctx.editMessage(
      `🎁 Seu cupom foi ativado!\n\n` +
      `Código: <code>${code}</code>\n\n` +
      `Clique no código para copiar.\n` +
      `Depois use /resgatar ${code} para adicionar o saldo.`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 Copiar código', callback_data: `copy_coupon_${code}` }],
            [{ text: '💳 Resgatar agora', callback_data: `redeem_coupon_${code}` }],
          ],
        },
      }
    );
  } catch (error: any) {
    await ctx.editMessage(`❌ ${error.message}`);
  }
}

// Resgata cupom via callback
export async function handleRedeemCoupon(ctx: Context, code: string) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });

  if (!user) return;

  const result = await redeemCoupon(user.id, code);
  await ctx.editMessage(result.message);
}

// Comando /resgatar
export async function handleResgatarCommand(ctx: Context) {
  const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ') : [];
  if (args.length < 2) {
    await ctx.reply('Use /resgatar CODIGO');
    return;
  }
  const code = args[1].toUpperCase();
  await handleRedeemCoupon(ctx, code);
}
