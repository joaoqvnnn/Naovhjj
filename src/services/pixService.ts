import prisma from '../database';
import config from '../config';
import { mercadopago } from './mercadopago';
import axios from 'axios';

// Interface para configuração Pix
interface PixConfig {
  mode: 'automatico' | 'manual';
  manualPixKey?: string;
  showQrCode: boolean;
  showCopyButton: boolean;
  expirationMinutes: number;
  minAmount: number;
  maxAmount: number;
}

// Obtém configuração Pix do banco
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

// Gera um QR Code em base64 a partir do código Pix (usando API externa)
export async function generateQrCodeBase64(pixCode: string): Promise<string | null> {
  try {
    // Exemplo usando API pública (pode ser substituída por serviço local)
    const response = await axios.get(`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(pixCode)}&size=200x200`);
    return response.data; // não é base64, é imagem binária; para simplificar, retornamos URL
  } catch {
    return null;
  }
}

// Gera dados Pix (automático ou manual)
export async function generatePixPayment(amount: number, userId: number, description: string) {
  const pixConfig = await getPixConfig();

  if (pixConfig.mode === 'automatico') {
    // Usa Mercado Pago
    const payment = await mercadopago.createPixPayment(amount, description, `user_${userId}_${Date.now()}`);
    return {
      mode: 'automatico',
      qrCode: payment.qrCode,
      qrCodeImage: payment.qrCodeImage,
      externalId: payment.id,
      expiresAt: payment.expiresAt,
    };
  } else {
    // Modo manual: usa chave Pix fixa e não gera cobrança automática
    // O admin deverá confirmar manualmente o pagamento
    const chave = pixConfig.manualPixKey || '';
    // Monta código Pix simples (pode ser melhorado com brcode)
    const pixCode = `PIX:${chave}:${amount.toFixed(2)}:${description}`;
    const qrImage = pixConfig.showQrCode ? await generateQrCodeBase64(pixCode) : null;
    return {
      mode: 'manual',
      qrCode: pixCode,
      qrCodeImage: qrImage,
      externalId: null,
      expiresAt: new Date(Date.now() + pixConfig.expirationMinutes * 60 * 1000),
    };
  }
}

// Verifica status de pagamento (somente automático)
export async function checkPixPaymentStatus(externalId: string): Promise<string> {
  return await mercadopago.getPaymentStatus(parseInt(externalId));
}

// Confirma manualmente um pagamento (modo manual)
export async function confirmManualPix(paymentId: number) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== 'PENDING') return false;
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({ where: { id: payment.id }, data: { status: 'APPROVED', paidAt: new Date() } });
    // Credita saldo
    await tx.user.update({ where: { id: payment.userId }, data: { balance: { increment: payment.amount } } });
    await tx.recharge.create({
      data: { userId: payment.userId, amount: payment.amount, paymentId: payment.id, status: 'APPROVED' },
    });
  });
  return true;
}
