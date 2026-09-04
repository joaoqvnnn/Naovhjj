import { Context } from '../types/context';
import prisma from '../database';
import { startCapture } from '../middlewares/capture';
import { formatCurrency } from '../utils/format';
import { reserveStock, getAvailableStock } from '../services/stock';

export async function startMultiplePurchase(ctx: Context, productId: number) {
  const available = await getAvailableStock(productId);
  const product = await prisma.product.findUnique({ where: { id: productId } });

  if (!product) return ctx.editMessageText('Product not found.');

  await startCapture(ctx, `qty_${productId}`, `How many logins do you want?\n\n📦 Stock: ${available}\n💵 Unit price: ${formatCurrency(product.price)}\n\nEnter quantity:`, {
    validate: async (input) => {
      const qty = parseInt(input);
      if (isNaN(qty) || qty < 1) return 'Invalid quantity.';
      if (qty > available) return `Insufficient stock. Available: ${available}`;
      return null;
    },
    onSuccess: async (ctx, qtyStr) => {
      const quantity = parseInt(qtyStr);
      const userId = ctx.from!.id;
      const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });

      if (!user) return ctx.editMessageText('User not found.');

      const total = parseFloat(product.price.toString()) * quantity;
      const balance = parseFloat(user.balance.toString());

      if (balance < total) {
        const missing = total - balance;
        await ctx.editMessageText(
          `❌ Insufficient balance!\n\n` +
          `💰 Your balance: ${formatCurrency(balance)}\n` +
          `💵 Total amount: ${formatCurrency(total)}\n` +
          `📉 Missing: ${formatCurrency(missing)}\n\n` +
          `Generate Pix?`,
          {
            reply_markup: {
              inline_keyboard: [
                [{ text: '💰 Generate Pix', callback_data: `pix_purchase_qty_${productId}_${quantity}` }],
                [{ text: '⏮️ Back', callback_data: `view_product_${productId}` }],
              ],
            },
          }
        );
        return;
      }

      try {
        const unitIds = await reserveStock(productId, quantity, user.id);

        const order = await prisma.$transaction(async (tx) => {
          await tx.user.update({ where: { id: user.id }, data: { balance: { decrement: total } } });
          const newOrder = await tx.order.create({
            data: {
              userId: user.id,
              productId,
              quantity,
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
          `🔢 Quantity: ${quantity}\n` +
          `💰 Total: ${formatCurrency(total)}\n` +
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
    },
  });
}
