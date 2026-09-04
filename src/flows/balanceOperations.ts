import { Context } from '../types/context';
import prisma from '../database';
import { creditBalance, debitBalance, setBalance } from '../services/wallet';
import { applyRechargeBonus } from '../services/bonus';
import { logAction } from '../services/logger';
import { formatCurrency } from '../utils/format';

// Processa aprovação de Pix (recarga)
export async function processPixRechargeApproved(paymentId: number) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { user: true },
  });

  if (!payment || payment.status === 'APPROVED') return;

  const amount = parseFloat(payment.amount.toString());

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: { status: 'APPROVED', paidAt: new Date() },
    });

    // Credita saldo base
    await tx.user.update({
      where: { id: payment.userId },
      data: { balance: { increment: amount } },
    });

    // Aplica bônus de recarga (se configurado)
    await applyRechargeBonus(payment.userId, amount);

    // Registra recarga
    await tx.recharge.create({
      data: {
        userId: payment.userId,
        amount: payment.amount,
        paymentId: payment.id,
        status: 'APPROVED',
      },
    });

    await tx.log.create({
      data: {
        userId: payment.userId,
        action: 'PIX_RECHARGE_APPROVED',
        details: { paymentId, amount },
      },
    });
  });
}

// Processa compra com saldo
export async function processPurchaseWithBalance(userId: number, productId: number, quantity: number): Promise<{ success: boolean; message: string; orderId?: number }> {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return { success: false, message: 'Produto não encontrado.' };

  const total = parseFloat(product.price.toString()) * quantity;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false, message: 'Usuário não encontrado.' };

  const balance = parseFloat(user.balance.toString());
  if (balance < total) {
    const faltante = total - balance;
    return {
      success: false,
      message: `Saldo insuficiente. Faltam ${formatCurrency(faltante)}.`,
    };
  }

  // Reserva estoque
  const { reserveStock } = await import('../services/stock');
  let unitIds: number[];
  try {
    unitIds = await reserveStock(productId, quantity, userId);
  } catch (error: any) {
    return { success: false, message: error.message };
  }

  // Debita saldo e cria pedido
  try {
    const order = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { balance: { decrement: total } },
      });

      const newOrder = await tx.order.create({
        data: {
          userId,
          productId,
          quantity,
          unitPrice: product.price,
          totalPrice: total,
          status: 'PAID',
        },
      });

      await tx.stockUnit.updateMany({
        where: { id: { in: unitIds } },
        data: { orderId: newOrder.id, isSold: true, isReserved: false },
      });

      await tx.log.create({
        data: {
          userId,
          action: 'PURCHASE_WITH_BALANCE',
          details: { orderId: newOrder.id, total },
        },
      });

      return newOrder;
    });

    return {
      success: true,
      message: 'Compra realizada com sucesso.',
      orderId: order.id,
    };
  } catch (error: any) {
    // Em caso de falha, libera estoque
    const { releaseReservation } = await import('../services/stock');
    await releaseReservation(unitIds);
    return { success: false, message: error.message };
  }
}

// Processa resgate de Gift Card
export async function processGiftCardRedemption(userId: number, code: string): Promise<{ success: boolean; message: string }> {
  const giftCard = await prisma.giftCard.findUnique({ where: { code } });

  if (!giftCard) return { success: false, message: 'Gift Card não encontrado.' };
  if (giftCard.status !== 'ACTIVE') return { success: false, message: 'Gift Card já utilizado ou desativado.' };
  if (giftCard.expiresAt && giftCard.expiresAt < new Date()) return { success: false, message: 'Gift Card expirado.' };

  const value = parseFloat(giftCard.value.toString());

  await prisma.$transaction(async (tx) => {
    await tx.giftCard.update({
      where: { id: giftCard.id },
      data: { status: 'USED', usedAt: new Date(), usedByUserId: userId },
    });

    await tx.user.update({
      where: { id: userId },
      data: { balance: { increment: value } },
    });

    await tx.log.create({
      data: {
        userId,
        action: 'GIFT_CARD_REDEEMED',
        details: { code, value },
      },
    });
  });

  return { success: true, message: `Gift Card resgatado. R$ ${value.toFixed(2)} adicionados.` };
}

// Processa conversão de pontos de afiliado
export async function processAffiliatePointsConversion(userId: number): Promise<{ success: boolean; message: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false, message: 'Usuário não encontrado.' };

  const config = await getPointsConfig();
  if (user.affiliatePoints < config.pointsMin) {
    return { success: false, message: `Pontos insuficientes. Mínimo: ${config.pointsMin}` };
  }

  const valor = user.affiliatePoints * config.multiplier;

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: {
        balance: { increment: valor },
        affiliatePoints: 0,
      },
    });

    await tx.log.create({
      data: {
        userId,
        action: 'AFFILIATE_POINTS_CONVERTED',
        details: { points: user.affiliatePoints, valor },
      },
    });
  });

  return { success: true, message: `Pontos convertidos. R$ ${valor.toFixed(2)} adicionados.` };
}

// Ajuste administrativo de saldo
export async function adminAdjustBalance(adminUserId: number, targetUserId: number, value: string): Promise<{ success: boolean; message: string }> {
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) return { success: false, message: 'Usuário não encontrado.' };

  const num = parseFloat(value.replace(',', '.'));

  try {
    if (value.startsWith('+')) {
      await creditBalance(targetUserId, num, 'ADMIN_ADJUST');
      return { success: true, message: `Saldo incrementado em ${formatCurrency(num)}.` };
    } else if (value.startsWith('-')) {
      await debitBalance(targetUserId, Math.abs(num), 'ADMIN_ADJUST');
      return { success: true, message: `Saldo decrementado em ${formatCurrency(Math.abs(num))}.` };
    } else {
      await setBalance(targetUserId, num);
      return { success: true, message: `Saldo definido para ${formatCurrency(num)}.` };
    }
  } catch (error: any) {
    return { success: false, message: error.message };
  }
}

// Função auxiliar para obter configurações de pontos
async function getPointsConfig() {
  const pointsMin = await prisma.setting.findUnique({ where: { key: 'affiliate_points_min' } });
  const multiplier = await prisma.setting.findUnique({ where: { key: 'affiliate_multiplier' } });

  return {
    pointsMin: pointsMin ? parseInt(pointsMin.value.toString()) : 500,
    multiplier: multiplier ? parseFloat(multiplier.value.toString()) : 0.01,
  };
}
