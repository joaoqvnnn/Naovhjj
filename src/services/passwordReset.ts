import prisma from '../database';
import bcrypt from 'bcryptjs';
import { generateRandomCode } from '../utils/format';
import { logAction } from './logger';

const CODE_EXPIRATION_MINUTES = 10; // pode ser configurável
const MAX_ATTEMPTS = 5;

// Gera e salva um código de recuperação para o usuário
export async function generatePasswordResetCode(userId: number): Promise<string> {
  // Invalida códigos anteriores
  await prisma.passwordResetCode.updateMany({
    where: { userId, used: false },
    data: { used: true },
  });

  const rawCode = generateRandomCode(6); // ex: ABC123
  const hashedCode = await bcrypt.hash(rawCode, 10);
  const expiresAt = new Date(Date.now() + CODE_EXPIRATION_MINUTES * 60 * 1000);

  await prisma.passwordResetCode.create({
    data: {
      userId,
      code: hashedCode,
      expiresAt,
    },
  });

  return rawCode; // retorna o código em texto puro apenas para envio
}

// Valida o código informado
export async function validatePasswordResetCode(userId: number, rawCode: string): Promise<boolean> {
  const resetCode = await prisma.passwordResetCode.findFirst({
    where: { userId, used: false },
    orderBy: { createdAt: 'desc' },
  });

  if (!resetCode) return false;
  if (resetCode.expiresAt < new Date()) {
    await prisma.passwordResetCode.update({ where: { id: resetCode.id }, data: { used: true } });
    return false;
  }
  if (resetCode.attempts >= MAX_ATTEMPTS) {
    await prisma.passwordResetCode.update({ where: { id: resetCode.id }, data: { used: true } });
    return false;
  }

  const valid = await bcrypt.compare(rawCode, resetCode.code);
  if (!valid) {
    // Incrementa tentativas
    await prisma.passwordResetCode.update({
      where: { id: resetCode.id },
      data: { attempts: { increment: 1 } },
    });
    return false;
  }

  // Marca como usado
  await prisma.passwordResetCode.update({ where: { id: resetCode.id }, data: { used: true } });
  return true;
}

// Redefine a senha do usuário
export async function resetPassword(userId: number, newPassword: string): Promise<void> {
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hashedPassword },
  });
  await logAction({ action: 'PASSWORD_RESET_COMPLETED', userId });
}
