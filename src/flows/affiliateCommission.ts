import prisma from '../database';
import { logAction } from '../services/logger';

// Obtém a taxa de comissão configurada (porcentagem)
async function getCommissionRate(): Promise<number> {
  const setting = await prisma.setting.findUnique({ where: { key: 'commission_rate' } });
  if (!setting) return 10; // padrão 10%
  return parseFloat(setting.value.toString());
}

// Função principal: credita comissão para o afiliado se o comprador tiver sido indicado
export async function creditAffiliateCommission(orderId: number): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true },
  });

  if (!order || !order.user.referredByUserId) return; // sem afiliado

  const rate = await getCommissionRate();
  const commission = (parseFloat(order.totalPrice.toString()) * rate) / 100;

  if (commission <= 0) return;

  // Atualiza saldo do afiliado e registra comissão
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: order.user.referredByUserId! },
      data: { affiliateBalance: { increment: commission } },
    });

    await tx.commission.create({
      data: {
        userId: order.user.referredByUserId!,
        orderId: order.id,
        amount: commission,
        status: 'AVAILABLE', // disponível para saque
      },
    });

    await tx.log.create({
      data: {
        userId: order.user.referredByUserId!,
        action: 'AFFILIATE_COMMISSION_CREDITED',
        details: { orderId, commission, rate },
      },
    });
  });
}
