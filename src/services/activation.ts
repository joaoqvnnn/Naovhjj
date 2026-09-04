import prisma from '../database';
import { logAction } from './logger';

// Obtém o limite máximo de acessos configurado (padrão: 5)
async function getMaxAccessLimit(): Promise<number> {
  const setting = await prisma.setting.findUnique({ where: { key: 'activation_access_limit' } });
  if (!setting) return 5;
  return parseInt(setting.value.toString()) || 5;
}

// Verifica se o pedido ainda pode ser acessado
export async function canAccessActivation(orderId: number): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { accessCount: true, maxAccess: true },
  });
  if (!order) return false;
  const max = order.maxAccess || await getMaxAccessLimit();
  return order.accessCount < max;
}

// Incrementa o contador de acessos
export async function incrementAccessCount(orderId: number): Promise<void> {
  await prisma.order.update({
    where: { id: orderId },
    data: { accessCount: { increment: 1 } },
  });
}

// Obtém o limite configurado para exibir na interface
export async function getAccessLimit(orderId: number): Promise<number> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { maxAccess: true },
  });
  if (order?.maxAccess) return order.maxAccess;
  return await getMaxAccessLimit();
}

// Define um limite específico para um pedido (pode ser usado pelo admin)
export async function setOrderAccessLimit(orderId: number, limit: number): Promise<void> {
  await prisma.order.update({
    where: { id: orderId },
    data: { maxAccess: limit },
  });
  await logAction({ action: 'ORDER_ACCESS_LIMIT_SET', details: { orderId, limit } });
}
