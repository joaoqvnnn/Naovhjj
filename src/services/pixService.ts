import prisma from '../database';
import config from '../config';
import { mercadopago } from './mercadopago';

interface PixConfig {
  mode: 'automatico' | 'manual';
  manualPixKey?: string;
  showQrCode: boolean;
  showCopyButton: boolean;
  expirationMinutes: number;
  minAmount: number;
  maxAmount: number;
}

export async function getPixConfig(): Promise<PixConfig> {
  const setting = await prisma.setting.findUnique({ where: { key: 'pix_config' } });
  if (setting) return setting.value as PixConfig;
  return {
    mode: 'automatico',
    manualPixKey: '',
    showQrCode: true,
    showCopyButton: true,
    expirationMinutes: 10,
    minAmount: 4,
    maxAmount: 1000,
  };
}

export async function generatePixPayment(amount: number, userId: number, description: string) {
  const pixConfig = await getPixConfig();

  if (pixConfig.mode === 'automatico') {
    const payment = await mercadopago.createPixPayment(amount, description, `user_${userId}_${Date.now()}`);
    return {
      mode: 'automatico',
      qrCode: payment.qrCode,
      qrCodeImage: payment.qrCodeImage,
      externalId: payment.id,
      expiresAt: payment.expiresAt,
    };
  } else {
    const chave = pixConfig.manualPixKey || '';
    const pixCode = `PIX:${chave}:${amount.toFixed(2)}:${description}`;
    return {
      mode: 'manual',
      qrCode: pixCode,
      qrCodeImage: null,
      externalId: null,
      expiresAt: new Date(Date.now() + pixConfig.expirationMinutes * 60 * 1000),
    };
  }
}

export async function checkPixPaymentStatus(externalId: string): Promise<string> {
  return await mercadopago.getPaymentStatus(parseInt(externalId));
}

export async function confirmManualPix(paymentId: number): Promise<boolean> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== 'PENDING') return false;

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: payment.id }, data: { status: 'APPROVED', paidAt: new Date() } });
    await tx.user.update({ where: { id: payment.userId }, data: { balance: { increment: payment.amount } } });
    await tx.recharge.create({
      data: { userId: payment.userId, amount: payment.amount, paymentId: payment.id, status: 'APPROVED' },
    });
  });

  return true;
}
