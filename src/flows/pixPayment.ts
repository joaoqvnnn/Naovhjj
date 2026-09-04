import { Context } from '../types/context';
import prisma from '../database';
import { formatCurrency } from '../utils/format';
import { generatePixPayment, getPixConfig, checkPixPaymentStatus, confirmManualPix } from '../services/pixService';
import { logAction } from '../services/logger';

export async function startPixPayment(ctx: Context, amount: number) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });

  if (!user) return ctx.editMessageText('Usuário não encontrado.');

  const pixConfig = await getPixConfig();
  if (amount < pixConfig.minAmount) {
    await ctx.editMessageText(`❌ Valor mínimo: ${formatCurrency(pixConfig.minAmount)}`);
    return;
  }
  if (amount > pixConfig.maxAmount) {
    await ctx.editMessageText(`❌ Valor máximo: ${formatCurrency(pixConfig.maxAmount)}`);
    return;
  }

  try {
    const paymentData = await generatePixPayment(amount, user.id, 'Recarga de saldo');

    const dbPayment = await prisma.payment.create({
      data: {
        userId: user.id,
        method: 'PIX',
        status: 'PENDING',
        amount,
        externalId: paymentData.externalId ? String(paymentData.externalId) : null,
        qrCode: paymentData.qrCode,
        qrCodeImage: paymentData.qrCodeImage,
        expiresAt: paymentData.expiresAt,
      },
    });

    const text = `💰 Comprar Saldo com Pix\n\n` +
      `💵 Valor: ${formatCurrency(amount)}\n` +
      `⏱️ Expira em: ${pixConfig.expirationMinutes} min\n` +
      `✨ ID: ${dbPayment.id}\n\n` +
      `💎 Pix Copia e Cola:\n<code>${paymentData.qrCode}</code>\n\n` +
      `Após pagar, clique em "Já paguei".`;

    const inlineKeyboard = [];
    if (pixConfig.showCopyButton && paymentData.qrCode) {
      inlineKeyboard.push([{ text: '📋 Copiar código Pix', callback_data: `pix_copy_${dbPayment.id}` }]);
    }
    inlineKeyboard.push([{ text: '🔄 Já paguei', callback_data: `pix_check_${dbPayment.id}` }]);
    inlineKeyboard.push([{ text: '⏮️ Voltar', callback_data: 'voltar_inicio' }]);

    if (pixConfig.showQrCode && paymentData.qrCodeImage) {
      await ctx.replyWithPhoto(paymentData.qrCodeImage, {
        caption: text,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: inlineKeyboard },
      });
    } else {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: inlineKeyboard },
      });
    }
  } catch (error: any) {
    await ctx.editMessageText(`❌ ${error.message}`);
  }
}

export async function checkPixPayment(ctx: Context, paymentId: number) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== 'PENDING') return;

  try {
    const status = await checkPixPaymentStatus(payment.externalId!);
    if (status === 'APPROVED') {
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({ where: { id: payment.id }, data: { status: 'APPROVED', paidAt: new Date() } });
        await tx.user.update({ where: { id: payment.userId }, data: { balance: { increment: payment.amount } } });
        await tx.recharge.create({
          data: { userId: payment.userId, amount: payment.amount, paymentId: payment.id, status: 'APPROVED' },
        });
      });
      await ctx.editMessageText('✅ Pagamento aprovado! Saldo creditado.');
    } else if (status === 'CANCELLED' || status === 'EXPIRED') {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'EXPIRED' } });
      await ctx.editMessageText('⌛️ Pagamento expirado ou cancelado.');
    } else {
      await ctx.editMessageText('⏳ Pagamento ainda pendente.');
    }
  } catch (error) {
    console.error(error);
    await ctx.editMessageText('❌ Erro ao verificar pagamento.');
  }
}
