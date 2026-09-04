import { Context } from '../types/context';
import prisma from '../database';
import { formatCurrency } from '../utils/format';
import { generatePixPayment, getPixConfig } from '../services/pixService';
import { reserveStock } from '../services/stock';

export async function startPurchasePix(ctx: Context, productId: number, quantity: number = 1) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
  const product = await prisma.product.findUnique({ where: { id: productId } });

  if (!user || !product) return ctx.editMessageText('Product or user not found.');

  const total = parseFloat(product.price.toString()) * quantity;

  try {
    const unitIds = await reserveStock(productId, quantity, user.id);

    const paymentData = await generatePixPayment(total, user.id, `Purchase: ${product.name}`);

    const order = await prisma.order.create({
      data: {
        userId: user.id,
        productId,
        quantity,
        unitPrice: product.price,
        totalPrice: total,
        status: 'RESERVED',
      },
    });

    const dbPayment = await prisma.payment.create({
      data: {
        userId: user.id,
        orderId: order.id,
        method: 'PIX',
        status: 'PENDING',
        amount: total,
        externalId: paymentData.externalId ? String(paymentData.externalId) : null,
        qrCode: paymentData.qrCode,
        qrCodeImage: paymentData.qrCodeImage,
        expiresAt: paymentData.expiresAt,
      },
    });

    await prisma.stockUnit.updateMany({
      where: { id: { in: unitIds } },
      data: { orderId: order.id },
    });

    const pixConfig = await getPixConfig();
    const text = `💰 Purchase via Pix\n\n` +
      `Product: ${product.name}\n` +
      `Quantity: ${quantity}\n` +
      `Total: ${formatCurrency(total)}\n` +
      `Expires: ${pixConfig.expirationMinutes} min\n` +
      `ID: ${dbPayment.id}\n\n` +
      `💎 Pix Copy and Paste:\n<code>${paymentData.qrCode}</code>\n\n` +
      `After paying, click "I paid".`;

    const inlineKeyboard = [];
    if (pixConfig.showCopyButton && paymentData.qrCode) {
      inlineKeyboard.push([{ text: '📋 Copy Pix', callback_data: `pix_copy_${dbPayment.id}` }]);
    }
    inlineKeyboard.push([{ text: '🔄 I paid', callback_data: `pix_check_purchase_${dbPayment.id}` }]);
    inlineKeyboard.push([{ text: '⏮️ Back', callback_data: 'back_to_start' }]);

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
