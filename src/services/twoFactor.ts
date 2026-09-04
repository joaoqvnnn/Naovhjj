import prisma from '../database';
import { generateRandomCode } from '../utils/format';
import { sendPasswordResetCode } from './email';
import { logAction } from './logger';

const CODE_EXPIRATION_MINUTES = 5;
const MAX_ATTEMPTS = 3;

// Gera e envia código 2FA por e-mail
export async function generateTwoFactorCode(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.email) return false;

  // Invalida códigos anteriores
  await prisma.twoFactorCode.updateMany({
    where: { userId, used: false },
    data: { used: true },
  });

  const code = generateRandomCode(6);
  const expiresAt = new Date(Date.now() + CODE_EXPIRATION_MINUTES * 60 * 1000);

  await prisma.twoFactorCode.create({
    data: {
      userId,
      code: await hashCode(code),
      expiresAt,
      attempts: 0,
    },
  });

  // Envia o código por e-mail
  const sent = await sendPasswordResetCode(user.email, code); // reutiliza função de envio
  if (sent) {
    await logAction({ action: '2FA_CODE_SENT', userId });
  }
  return sent;
}

// Valida o código 2FA
export async function validateTwoFactorCode(userId: number, rawCode: string): Promise<boolean> {
  const codeEntry = await prisma.twoFactorCode.findFirst({
    where: { userId, used: false },
    orderBy: { createdAt: 'desc' },
  });

  if (!codeEntry) return false;
  if (codeEntry.expiresAt < new Date()) {
    await prisma.twoFactorCode.update({ where: { id: codeEntry.id }, data: { used: true } });
    return false;
  }
  if (codeEntry.attempts >= MAX_ATTEMPTS) {
    await prisma.twoFactorCode.update({ where: { id: codeEntry.id }, data: { used: true } });
    return false;
  }

  const valid = await compareHash(rawCode, codeEntry.code);
  if (!valid) {
    await prisma.twoFactorCode.update({
      where: { id: codeEntry.id },
      data: { attempts: { increment: 1 } },
    });
    return false;
  }

  await prisma.twoFactorCode.update({ where: { id: codeEntry.id }, data: { used: true } });
  return true;
}

// Funções auxiliares de hash
async function hashCode(code: string): Promise<string> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.hash(code, 10);
}

async function compareHash(code: string, hash: string): Promise<boolean> {
  const bcrypt = await import('bcryptjs');
  return bcrypt.compare(code, hash);
}
