import prisma from '../database';

export interface DetailedStats {
  totalUsers: number;
  activeUsers: number;
  totalRevenue: number;
  monthlyRevenue: number;
  todayRevenue: number;
  totalOrders: number;
  todayOrders: number;
  pendingPayments: number;
  expiredPayments: number;
  totalWithdrawals: number;
  totalProducts: number;
  totalStockUnits: number;
  lowStockProducts: number;
}

export async function getDetailedStats(): Promise<DetailedStats> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalUsers,
    activeUsers,
    totalRevenueAgg,
    monthlyRevenueAgg,
    todayRevenueAgg,
    totalOrders,
    todayOrders,
    pendingPayments,
    expiredPayments,
    totalWithdrawals,
    totalProducts,
    totalStockUnits,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'ACTIVE' } }),
    prisma.payment.aggregate({ where: { status: 'APPROVED' }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: 'APPROVED', paidAt: { gte: startOfMonth } }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: 'APPROVED', paidAt: { gte: startOfToday } }, _sum: { amount: true } }),
    prisma.order.count(),
    prisma.order.count({ where: { createdAt: { gte: startOfToday } } }),
    prisma.payment.count({ where: { status: 'PENDING' } }),
    prisma.payment.count({ where: { status: 'EXPIRED' } }),
    prisma.withdrawal.count({ where: { status: 'PAID' } }),
    prisma.product.count(),
    prisma.stockUnit.count({ where: { isSold: false } }),
  ]);

  // Produtos com estoque baixo (menos de 5 unidades disponíveis)
  const lowStockProducts = await prisma.product.count({
    where: {
      stockUnits: {
        some: { isSold: false, isReserved: false },
      },
    },
  });

  return {
    totalUsers,
    activeUsers,
    totalRevenue: parseFloat(totalRevenueAgg._sum.amount?.toString() || '0'),
    monthlyRevenue: parseFloat(monthlyRevenueAgg._sum.amount?.toString() || '0'),
    todayRevenue: parseFloat(todayRevenueAgg._sum.amount?.toString() || '0'),
    totalOrders,
    todayOrders,
    pendingPayments,
    expiredPayments,
    totalWithdrawals,
    totalProducts,
    totalStockUnits,
    lowStockProducts,
  };
}
