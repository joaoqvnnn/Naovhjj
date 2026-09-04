import prisma from '../database';
import { generateRandomCode } from '../utils/format';
import { logAction } from './logger';

// Ativa um cupom para o usuário (gera se não existir)
export async function activateCouponForUser(userId: number, couponPromotionId: number): Promise<string> {
  // Busca a promoção de cupom
  const promotion = await prisma.couponPromotion.findUnique({
    where: { id: couponPromotionId },
  });

  if (!promotion || !promotion.isActive) {
    throw new Error('Cupom indisponível.');
  }

  // Verifica se o usuário já tem um cupom ativo para esta promoção
  const existing = await prisma.userCoupon.findFirst({
    where: {
      userId,
      couponPromotionId,
      used: false,
      expiresAt: { gt: new Date() },
    },
  });

  if (existing) {
    return existing.code;
  }

  // Gera código único
  const code = generateRandomCode(8).toUpperCase();

  // Cria registro para o usuário
  await prisma.userCoupon.create({
    data: {
      userId,
      couponPromotionId,
      code,
      expiresAt: promotion.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h padrão
    },
  });

  await logAction({
    action: 'COUPON_ACTIVATED',
    userId,
    details: { couponPromotionId, code },
  });

  return code;
}

// Resgata um cupom (aplica desconto ou crédito)
export async function redeemCoupon(userId: number, code: string): Promise<{ success: boolean; message: string; value?: number }> {
  const userCoupon = await prisma.userCoupon.findFirst({
    where: {
      code: code.toUpperCase(),
      userId,
      used: false,
      expiresAt: { gt: new Date() },
    },
    include: {
      couponPromotion: true,
    },
  });

  if (!userCoupon) {
    return { success: false, message: 'Cupom inválido, expirado ou já utilizado.' };
  }

  // Aplica o valor do cupom (pode ser desconto ou crédito em saldo)
  const value = parseFloat(userCoupon.couponPromotion.value.toString());

  await prisma.$transaction(async (tx) => {
    // Marca como usado
    await tx.userCoupon.update({
      where: { id: userCoupon.id },
      data: { used: true, usedAt: new Date() },
    });

    // Credita saldo na carteira
    await tx.user.update({
      where: { id: userId },
      data: { balance: { increment: value } },
    });
  });

  await logAction({
    action: 'COUPON_REDEEMED',
    userId,
    details: { couponPromotionId: userCoupon.couponPromotionId, code, value },
  });

  return { success: true, message: `Cupom resgatado! R$ ${value.toFixed(2)} adicionados ao saldo.`, value };
}
