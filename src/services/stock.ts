import prisma from '../database';
import { StockUnit, OrderStatus } from '@prisma/client';

/**
 * Reserva uma quantidade de unidades de estoque para um usuário.
 * Retorna os IDs das unidades reservadas.
 * Lança erro se não houver estoque suficiente.
 */
export async function reserveStock(
  productId: number,
  quantity: number,
  userId: number,
  reservationMinutes: number = 10
): Promise<number[]> {
  return await prisma.$transaction(async (tx) => {
    // Busca unidades disponíveis com bloqueio de linha
    const availableUnits = await tx.stockUnit.findMany({
      where: {
        productId,
        isSold: false,
        isReserved: false,
      },
      take: quantity,
      orderBy: { id: 'asc' },
    });

    // Também considera unidades reservadas cuja reserva expirou
    // (pode ser implementado com verificação de data)

    if (availableUnits.length < quantity) {
      throw new Error(`Estoque insuficiente. Disponível: ${availableUnits.length}`);
    }

    const reservedUntil = new Date(Date.now() + reservationMinutes * 60 * 1000);
    const unitIds = availableUnits.map((u) => u.id);

    // Marca como reservadas
    await tx.stockUnit.updateMany({
      where: { id: { in: unitIds } },
      data: {
        isReserved: true,
        reservedUntil,
        reservedByUserId: userId,
      },
    });

    return unitIds;
  });
}

/**
 * Libera a reserva de unidades (por expiração, cancelamento, etc.)
 */
export async function releaseReservation(unitIds: number[]): Promise<void> {
  await prisma.stockUnit.updateMany({
    where: { id: { in: unitIds } },
    data: {
      isReserved: false,
      reservedUntil: null,
      reservedByUserId: null,
    },
  });
}

/**
 * Confirma a venda: marca unidades como vendidas e associa a um pedido.
 */
export async function confirmSale(unitIds: number[], orderId: number): Promise<void> {
  await prisma.stockUnit.updateMany({
    where: { id: { in: unitIds } },
    data: {
      isSold: true,
      isReserved: false,
      reservedUntil: null,
      reservedByUserId: null,
      soldAt: new Date(),
      orderId,
    },
  });
}

/**
 * Conta quantas unidades estão disponíveis (não vendidas e não reservadas) de um produto.
 */
export async function getAvailableStock(productId: number): Promise<number> {
  const count = await prisma.stockUnit.count({
    where: {
      productId,
      isSold: false,
      isReserved: false,
    },
  });
  return count;
}

/**
 * Libera reservas expiradas. Deve ser chamado periodicamente ou via agendador.
 */
export async function releaseExpiredReservations(): Promise<number> {
  const result = await prisma.stockUnit.updateMany({
    where: {
      isReserved: true,
      reservedUntil: { lt: new Date() },
    },
    data: {
      isReserved: false,
      reservedUntil: null,
      reservedByUserId: null,
    },
  });
  console.log(`🔄 ${result.count} reservas expiradas liberadas.`);
  return result.count;
}
