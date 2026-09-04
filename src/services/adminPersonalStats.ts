import prisma from '../database';

export async function getAdminPersonalStats(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      orders: true,
      giftCards: { where: { usedByUserId: userId } },
      referredUsers: true,
    },
  });

  if (!user) return null;

  const totalSpent = user.orders
    .filter(o => o.status === 'PAID' || o.status === 'DELIVERED')
    .reduce((acc, o) => acc + parseFloat(o.totalPrice.toString()), 0);

  const giftCardsResgatados = user.giftCards.reduce((acc, g) => acc + parseFloat(g.value.toString()), 0);

  const affiliateCount = user.referredUsers.length;
  const affiliatePoints = user.affiliatePoints || 0;
  const referralLink = `https://t.me/larizinhastorebot?start=${user.telegramId}`;

  return {
    comprasFeitas: user.orders.length,
    totalGasto: totalSpent,
    giftCardsResgatados,
    affiliateCount,
    affiliatePoints,
    referralLink,
  };
}
