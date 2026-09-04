import prisma from '../database';
import { logAction } from '../services/logger';
import { releaseReservation } from '../services/stock';
import { bot } from '../bot'; // importa o bot para enviar mensagem

const INTERVAL_MS = 60 * 1000; // 1 minuto

export async function checkExpiredPixPayments() {
  try {
    // Busca pagamentos PIX pendentes e vencidos
    const expiredPayments = await prisma.payment.findMany({
      where: {
        method: 'PIX',
        status: 'PENDING',
        expiresAt: { lt: new Date() },
      },
      include: {
        order: { include: { stockUnits: true } },
        user: true,
      },
    });

    for (const payment of expiredPayments) {
      // Atualiza pagamento para EXPIRED
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'EXPIRED' },
      });

      // Se houver pedido associado com status RESERVED, libera estoque e cancela pedido
      if (payment.order && payment.order.status === 'RESERVED') {
        const unitIds = payment.order.stockUnits.map(u => u.id);
        if (unitIds.length > 0) {
          await releaseReservation(unitIds);
        }
        await prisma.order.update({
          where: { id: payment.order.id },
          data: { status: 'CANCELLED' },
        });
      }

      // Envia mensagem ao usuário (template editável)
      const template = await prisma.messageTemplate.findUnique({
        where: { key: 'pix_expirado' },
      });
      const messageText = template?.text || 
        `⌛️ PAGAMENTO PIX EXPIRADO\n\n` +
        `⚠️ O tempo limite para realizar este pagamento foi excedido.\n\n` +
        `🆔 Referência do Pagamento: ${payment.id}\n` +
        `💸 Valor Solicitado: R$ ${payment.amount.toFixed(2)}`;

      try {
        await bot.telegram.sendMessage(payment.user.telegramId.toString(), messageText, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '💰 Fazer nova recarga', callback_data: 'menu_recarregar' }],
              [{ text: '🏠 Menu Principal', callback_data: 'voltar_inicio' }],
            ],
          },
        });
      } catch (sendError) {
        console.error(`Falha ao notificar usuário ${payment.user.telegramId}:`, sendError);
      }

      // Registra log
      await logAction({
        action: 'PIX_PAYMENT_EXPIRED',
        userId: payment.userId,
        details: { paymentId: payment.id, amount: payment.amount.toString() },
      });
    }

    if (expiredPayments.length > 0) {
      console.log(`✅ ${expiredPayments.length} pagamento(s) Pix expirado(s) processado(s).`);
    }
  } catch (error) {
    console.error('❌ Erro no worker de expiração Pix:', error);
  }
}

// Inicia o worker
export function startPixExpirationWorker() {
  console.log('⏳ Worker de expiração Pix iniciado.');
  // Executa imediatamente e depois a cada INTERVAL_MS
  checkExpiredPixPayments().catch(console.error);
  setInterval(() => {
    checkExpiredPixPayments().catch(console.error);
  }, INTERVAL_MS);
}
