import { Router, Request, Response } from 'express';
import prisma from '../database';
import { PaymentStatus } from '@prisma/client';
import { mercadopago } from '../services/mercadopago';
import { confirmSale, releaseReservation } from '../services/stock';
import { applyRechargeBonus } from '../services/bonus';
import { creditAffiliateCommission } from '../flows/affiliateCommission';
import { handlePaymentApproved, handleSaleCompleted, handleAffiliateRecharge } from '../integrations/eventHooks';
import { logAction } from '../services/logger';

const router = Router();

router.post('/mercadopago', async (req, res) => {
  try {
    const paymentId = req.body?.data?.id;
    if (!paymentId) return res.status(400).send('ID não fornecido');

    const status = await mercadopago.getPaymentStatus(paymentId);
    const externalId = String(paymentId);

    const payment = await prisma.payment.findUnique({
      where: { externalId },
      include: { order: { include: { stockUnits: true } }, user: true },
    });

    if (!payment) return res.status(404).send('Pagamento não encontrado');
    if (payment.status === 'APPROVED') return res.status(200).send('Já processado');

    if (status === 'APPROVED') {
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'APPROVED', paidAt: new Date() },
        });

        if (payment.orderId) {
          const order = await tx.order.findUnique({
            where: { id: payment.orderId },
            include: { stockUnits: true, user: true },
          });
          if (!order) throw new Error('Pedido não encontrado');

          await tx.order.update({
            where: { id: order.id },
            data: { status: 'PAID' },
          });

          const unitIds = order.stockUnits.map(u => u.id);
          await confirmSale(unitIds, order.id);

          // Comissão de afiliado
          await creditAffiliateCommission(order.id);

          // Notificações
          await handleSaleCompleted(order.id, payment.userId, order.user.firstName || 'Cliente', parseFloat(order.totalPrice.toString()));
        } else {
          // Recarga de saldo
          await tx.user.update({
            where: { id: payment.userId },
            data: { balance: { increment: payment.amount } },
          });
          await tx.recharge.create({
            data: {
              userId: payment.userId,
              amount: payment.amount,
              paymentId: payment.id,
              status: 'APPROVED',
            },
          });

          // Bônus de recarga
          await applyRechargeBonus(payment.userId, parseFloat(payment.amount.toString()));

          // Pontos de afiliado (se houver referenciador)
          const user = await tx.user.findUnique({
            where: { id: payment.userId },
            select: { referredByUserId: true },
          });
          if (user?.referredByUserId) {
            await handleAffiliateRecharge(user.referredByUserId, parseFloat(payment.amount.toString()));
          }
        }

        await handlePaymentApproved(payment.id, payment.userId, parseFloat(payment.amount.toString()), payment.method);
      });

      console.log(`✅ Pagamento aprovado e processado: ${externalId}`);
      return res.status(200).send('OK');
    } else if (status === 'CANCELLED' || status === 'EXPIRED' || status === 'REFUNDED') {
      if (payment.orderId) {
        const order = await prisma.order.findUnique({
          where: { id: payment.orderId },
          include: { stockUnits: true },
        });
        if (order && order.status === 'RESERVED') {
          const unitIds = order.stockUnits.map(u => u.id);
          await releaseReservation(unitIds);
          await prisma.order.update({
            where: { id: order.id },
            data: { status: 'CANCELLED' },
          });
        }
      }
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: status as PaymentStatus },
      });
      return res.status(200).send('OK');
    }

    return res.status(200).send('Aguardando');
  } catch (error) {
    console.error('❌ Erro no webhook:', error);
    return res.status(500).send('Erro interno');
  }
});

export default router;
