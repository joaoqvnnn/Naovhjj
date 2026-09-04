import { Router, Request, Response } from 'express';
import prisma from '../database';
import config from '../config';
import { PaymentStatus } from '@prisma/client';
import { confirmSale, releaseReservation } from '../services/stock';
import { sendPurchaseEmail } from '../services/email';
import { sendWhatsAppDelivery } from '../services/whatsapp';

const router = Router();

// Rota para receber notificações do Mercado Pago
router.post('/mercadopago', async (req: Request, res: Response) => {
  try {
    // Em produção, validar assinatura do webhook (cabeçalhos ou segredo)
    // Exemplo simples: verificar se o corpo contém 'data.id'
    const paymentId = req.body?.data?.id;
    if (!paymentId) {
      return res.status(400).send('ID não fornecido');
    }

    // Busca o pagamento no Mercado Pago para obter dados atualizados
    // (pode usar o serviço mercadopago.getPaymentStatus)
    const { mercadopago } = await import('../services/mercadopago');
    const status = await mercadopago.getPaymentStatus(paymentId);
    const externalId = String(paymentId);

    // Encontra o Payment no nosso banco
    const payment = await prisma.payment.findUnique({
      where: { externalId },
      include: { order: true, user: true },
    });

    if (!payment) {
      console.warn(`Webhook recebido para pagamento desconhecido: ${externalId}`);
      return res.status(404).send('Pagamento não encontrado');
    }

    // Se já estiver aprovado ou processado, ignora (idempotência)
    if (payment.status === 'APPROVED') {
      return res.status(200).send('Pagamento já processado');
    }

    // Atualiza status no banco
    if (status === 'APPROVED') {
      // Transação para garantir consistência
      await prisma.$transaction(async (tx) => {
        // Atualiza pagamento
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'APPROVED', paidAt: new Date() },
        });

        if (payment.orderId) {
          // Pagamento associado a um pedido (compra de produto)
          const order = await tx.order.findUnique({
            where: { id: payment.orderId },
            include: { stockUnits: true },
          });

          if (!order) throw new Error('Pedido não encontrado');

          // Marca pedido como pago
          await tx.order.update({
            where: { id: order.id },
            data: { status: 'PAID' },
          });

          // Confirma venda das unidades reservadas
          const unitIds = order.stockUnits.map((u) => u.id);
          await confirmSale(unitIds, order.id);

          // Após confirmar, podemos disparar a entrega automaticamente (se configurado)
          // Neste exemplo, deixamos para o cliente escolher como receber
          // Mas podemos enviar via e-mail se já houver e-mail cadastrado, etc.
        } else {
          // Pagamento de recarga de saldo
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
        }
      });

      console.log(`✅ Pagamento aprovado e processado: ${externalId}`);
      return res.status(200).send('OK');
    } else if (status === 'CANCELLED' || status === 'EXPIRED' || status === 'REFUNDED') {
      // Se estava pendente e expirou/cancelou, libera reserva (se houver)
      if (payment.orderId) {
        const order = await prisma.order.findUnique({
          where: { id: payment.orderId },
          include: { stockUnits: true },
        });
        if (order && order.status === 'RESERVED') {
          const unitIds = order.stockUnits.map((u) => u.id);
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

      console.log(`ℹ️ Pagamento ${externalId} atualizado para ${status}`);
      return res.status(200).send('OK');
    }

    // Status pendente, nada a fazer
    return res.status(200).send('Aguardando');
  } catch (error) {
    console.error('❌ Erro no webhook:', error);
    return res.status(500).send('Erro interno');
  }
});

export default router;
