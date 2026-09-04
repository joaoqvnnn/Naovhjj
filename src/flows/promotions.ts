import { Context } from '../types/context';
import prisma from '../database';
import { activateCouponForUser, redeemCoupon } from '../services/coupons';
import { logAction } from '../services/logger';
import { trackProductView } from '../services/viewers';

// Envia promoção para um usuário específico (chamado pelo scheduler)
export async function sendPromotionToUser(userId: number, promoMessage: string, couponId?: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;

  try {
    const bot = (await import('../bot')).default;
    const sent = await bot.telegram.sendMessage(user.telegramId.toString(), promoMessage, {
      reply_markup: couponId
        ? { inline_keyboard: [[{ text: '🎁 Ativar Cupom', callback_data: `activate_coupon_${couponId}` }]] }
        : undefined,
    });

    // Agenda a remoção da mensagem após tempo configurável (default 20 min)
    const autoDeleteMs = await getAutoDeleteTime();
    setTimeout(async () => {
      try {
        await bot.telegram.deleteMessage(user.telegramId.toString(), sent.message_id);
        await logAction({ action: 'PROMOTION_MESSAGE_DELETED', userId, details: { messageId: sent.message_id } });
      } catch (e) {
        // Mensagem pode já ter sido apagada pelo usuário
      }
    }, autoDeleteMs);

    // Registra log de envio
    await logAction({ action: 'PROMOTION_SENT', userId, details: { promoMessage } });
  } catch (error) {
    console.error(`Falha ao enviar promoção para ${user.telegramId}:`, error);
  }
}

// Obtém tempo de auto-delete configurado (em ms)
async function getAutoDeleteTime(): Promise<number> {
  const setting = await prisma.setting.findUnique({ where: { key: 'promotion_auto_delete_ms' } });
  return setting ? parseInt(setting.value.toString()) : 20 * 60 * 1000;
}

// Handler do botão "Ativar Cupom"
export async function handleActivateCoupon(ctx: Context, couponPromotionId: number) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
  if (!user) return;

  try {
    const code = await activateCouponForUser(user.id, couponPromotionId);
    await ctx.editMessage(
      `Cupom ativado!\n\nCódigo: <code>${code}</code>\n\nClique para copiar e resgatar.`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 Copiar código', callback_data: `copy_coupon_${code}` }],
            [{ text: '💳 Resgatar', callback_data: `redeem_coupon_${code}` }],
          ],
        },
      }
    );
  } catch (error: any) {
    await ctx.editMessage(`Erro: ${error.message}`);
  }
}

// Handler de resgate
export async function handleRedeemCoupon(ctx: Context, code: string) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
  if (!user) return;

  const result = await redeemCoupon(user.id, code);
  await ctx.editMessage(result.message);
}

export async function handleResgatarCommand(ctx: Context) {
  const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ') : [];
  if (args.length < 2) {
    await ctx.reply('Use /resgatar CODIGO');
    return;
  }
  await handleRedeemCoupon(ctx, args[1].toUpperCase());
}
