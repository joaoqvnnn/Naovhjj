import prisma from '../database';
import { logAction } from './logger';
import { bot } from '../bot';

// Intervalo de verificação (30 segundos para precisão de segundos)
const CHECK_INTERVAL_MS = 30 * 1000;

export async function checkScheduledPromotions() {
  const now = new Date();

  // Busca promoções agendadas não enviadas e com data/hora <= agora
  const promotions = await prisma.scheduledPromotion.findMany({
    where: {
      sent: false,
      scheduledAt: { lte: now },
    },
    include: {
      coupon: true, // se houver cupom vinculado
    },
  });

  for (const promo of promotions) {
    // Determina destinatários (todos, ativos, compradores, etc.)
    let users;
    switch (promo.segment) {
      case 'all':
        users = await prisma.user.findMany({ where: { status: 'ACTIVE' } });
        break;
      case 'active':
        users = await prisma.user.findMany({ where: { status: 'ACTIVE' } });
        break;
      case 'buyers':
        users = await prisma.user.findMany({ where: { orders: { some: {} } } });
        break;
      case 'affiliates':
        users = await prisma.user.findMany({ where: { affiliateBalance: { gt: 0 } } });
        break;
      default:
        users = await prisma.user.findMany({ where: { status: 'ACTIVE' } });
    }

    // Envia mensagem para cada usuário ativo
    for (const user of users) {
      try {
        let messageText = promo.message;

        // Se houver cupom vinculado, adiciona botão "Ativar Cupom"
        if (promo.couponId) {
          const keyboard = {
            inline_keyboard: [
              [{ text: '🎁 Ativar Cupom', callback_data: `activate_coupon_${promo.couponId}` }],
            ],
          };
          await bot.telegram.sendMessage(user.telegramId.toString(), messageText, {
            reply_markup: keyboard,
          });
        } else {
          await bot.telegram.sendMessage(user.telegramId.toString(), messageText);
        }
        await new Promise(resolve => setTimeout(resolve, 50)); // delay entre envios
      } catch (error) {
        console.error(`Falha ao enviar promoção para ${user.telegramId}:`, error);
      }
    }

    // Marca como enviada
    await prisma.scheduledPromotion.update({
      where: { id: promo.id },
      data: { sent: true, sentAt: new Date() },
    });

    await logAction({
      action: 'SCHEDULED_PROMOTION_SENT',
      details: { promotionId: promo.id, users: users.length },
    });
  }
}

export function startScheduler() {
  console.log('⏰ Scheduler de promoções iniciado.');
  checkScheduledPromotions().catch(console.error);
  setInterval(() => {
    checkScheduledPromotions().catch(console.error);
  }, CHECK_INTERVAL_MS);
}
