import prisma from '../database';
import { logAction } from './logger';

/**
 * Credita saldo na carteira do usuário.
 * @param userId ID do usuário
 * @param amount Valor a creditar (positivo)
 * @param reason Motivo do crédito (ex: PIX_APROVADO, GIFT_CARD, BONUS, etc.)
 */
export async function creditBalance(userId: number, amount: number, reason: string): Promise<void> {
  if (amount <= 0) throw new Error('Valor deve ser positivo.');

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { balance: { increment: amount } },
    });

    await tx.log.create({
      data: {
        userId,
        action: 'BALANCE_CREDITED',
        details: { amount, reason },
      },
    });
  });

  await logAction({ action: 'BALANCE_CREDITED', userId, details: { amount, reason } });
}

/**
 * Debita saldo da carteira do usuário.
 * @param userId ID do usuário
 * @param amount Valor a debitar (positivo)
 * @param reason Motivo do débito (ex: COMPRA_APROVADA, AJUSTE_ADMIN, etc.)
 */
export async function debitBalance(userId: number, amount: number, reason: string): Promise<void> {
  if (amount <= 0) throw new Error('Valor deve ser positivo.');

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('Usuário não encontrado.');

    const current = parseFloat(user.balance.toString());
    if (current < amount) throw new Error('Saldo insuficiente.');

    await tx.user.update({
      where: { id: userId },
      data: { balance: { decrement: amount } },
    });

    await tx.log.create({
      data: {
        userId,
        action: 'BALANCE_DEBITED',
        details: { amount, reason },
      },
    });
  });

  await logAction({ action: 'BALANCE_DEBITED', userId, details: { amount, reason } });
}

/**
 * Ajusta o saldo para um valor absoluto (usado pelo admin).
 * @param userId ID do usuário
 * @param newBalance Novo saldo
 */
export async function setBalance(userId: number, newBalance: number): Promise<void> {
  if (newBalance < 0) throw new Error('Saldo não pode ser negativo.');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('Usuário não encontrado.');

  const oldBalance = parseFloat(user.balance.toString());

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { balance: newBalance },
    });

    await tx.log.create({
      data: {
        userId,
        action: 'BALANCE_SET',
        details: { oldBalance, newBalance },
      },
    });
  });

  await logAction({ action: 'BALANCE_SET', userId, details: { oldBalance, newBalance } });
}

/**
 * Obtém o saldo atual do usuário.
 */
export async function getBalance(userId: number): Promise<number> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('Usuário não encontrado.');
  return parseFloat(user.balance.toString());
}

/**
 * Estorna um débito (devolve saldo para o usuário).
 */
export async function refundBalance(userId: number, amount: number, reason: string): Promise<void> {
  await creditBalance(userId, amount, `REFUND: ${reason}`);
}
