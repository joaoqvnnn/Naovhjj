import { Context } from '../types/context';
import prisma from '../database';
import { formatCurrency } from '../utils/format';
import { reserveStock, getAvailableStock } from '../services/stock';

export async function purchaseProduct(ctx: Context, productId: number) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
  const product = await prisma.product.findUnique({ where: { id: productId } });

  if (!user || !product) return ctx.editMessageText('Product or user not found.');

  const total = parseFloat(product.price.toString());
  const balance = parseFloat(user.balance.toString());

  if (balance < total) {
    const missing = total - balance;
    await ctx.editMessageText(
      `❌ Insufficient balance!\n\n` +
      `💰 Your balance: ${formatCurrency(balance)}\n` +
      `💵 Product price: ${formatCurrency(total)}\n` +
      `📉 Missing: ${formatCurrency(missing)}\n\n` +
      `Do you want to generate a Pix?`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '💰 Generate Pix', callback_data: `pix_purchase_${productId}` }],
            [{ text: '⏮️ Back', callback_data: `view_product_${productId}` }],
          ],
        },
      }
    );
    return;
  }

  try {
    const unitIds = await reserveStock(productId, 1, user.id);

    const order = await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { balance: { decrement: total } } });
      const newOrder = await tx.order.create({
        data: {
          userId: user.id,
          productId,
          quantity: 1,
          unitPrice: product.price,
          totalPrice: total,
          status: 'PAID',
        },
      });
      await tx.stockUnit.updateMany({
        where: { id: { in: unitIds } },
        data: { orderId: newOrder.id, isSold: true, isReserved: false },
      });
      return newOrder;
    });

    await ctx.editMessageText(
      `✅ Purchase completed!\n\n` +
      `📦 Product: ${product.name}\n` +
      `💰 Amount: ${formatCurrency(total)}\n` +
      `🆔 Order: ${order.id}\n\n` +
      `Choose delivery method:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📱 WhatsApp', callback_data: `deliver_whatsapp_${order.id}` }],
            [{ text: '📧 Email', callback_data: `deliver_email_${order.id}` }],
            [{ text: '⏮️ Back', callback_data: 'back_to_start' }],
          ],
        },
      }
    );
  } catch (error: any) {
    await ctx.editMessageText(`❌ ${error.message}`);
  }
}
