import { Context } from '../types/context';
import prisma from '../database';
import { startCapture } from '../middlewares/capture';
import { normalizePhone, isValidEmail } from '../utils/format';
import { sendPurchaseEmail } from '../services/email';
import { sendWhatsAppButton } from '../services/whatsappApi';

export async function startWhatsAppDelivery(ctx: Context, orderId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true, product: true, stockUnits: true },
  });

  if (!order) return ctx.editMessageText('Order not found.');

  if (order.user.whatsapp && normalizePhone(order.user.whatsapp)) {
    const normalized = normalizePhone(order.user.whatsapp)!;
    const messageText = `🛍️ *Purchase completed!*\n\n` +
      `Product: ${order.product.name}\n` +
      `Amount: R$ ${order.totalPrice}\n` +
      `Date: ${order.createdAt.toLocaleDateString('pt-BR')}\n` +
      `Click the button below to activate:`;

    await sendWhatsAppButton(normalized, messageText, [
      { type: 'reply', displayText: 'Activate', id: 'activate' },
    ]);

    await ctx.editMessageText('✅ Purchase sent to WhatsApp!');
    return;
  }

  await startCapture(ctx, 'whatsapp_delivery', 'Enter your WhatsApp number (with DDD):', {
    validate: async (input) => normalizePhone(input) ? null : 'Invalid number.',
    onSuccess: async (ctx, phone) => {
      const normalized = normalizePhone(phone)!;
      await prisma.user.update({ where: { id: order.userId }, data: { whatsapp: normalized } });
      await prisma.order.update({ where: { id: orderId }, data: { whatsapp: normalized, deliveryMethod: 'WHATSAPP' } });

      const messageText = `🛍️ *Purchase completed!*\n\n` +
        `Product: ${order.product.name}\n` +
        `Amount: R$ ${order.totalPrice}\n` +
        `Date: ${order.createdAt.toLocaleDateString('pt-BR')}\n` +
        `Click the button below to activate:`;

      await sendWhatsAppButton(normalized, messageText, [
        { type: 'reply', displayText: 'Activate', id: 'activate' },
      ]);

      await ctx.editMessageText('✅ Purchase sent to WhatsApp!');
    },
  });
}

export async function startEmailDelivery(ctx: Context, orderId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true, product: true, stockUnits: true },
  });

  if (!order) return ctx.editMessageText('Order not found.');

  if (order.user.email && isValidEmail(order.user.email)) {
    const success = await sendPurchaseEmail({
      to: order.user.email,
      orderId: order.id,
      productName: order.product.name,
      price: parseFloat(order.unitPrice.toString()),
      quantity: order.quantity,
      total: parseFloat(order.totalPrice.toString()),
      paymentMethod: order.payment?.method || 'SALDO',
      date: order.createdAt,
      validity: order.expiresAt?.toLocaleDateString('pt-BR') || '',
      description: order.product.description || '',
      loginData: order.stockUnits.map(u => u.content).join('\n'),
    });

    if (success) {
      await ctx.editMessageText('📧 Email sent successfully!');
    } else {
      await ctx.editMessageText('❌ Failed to send email.');
    }
    return;
  }

  await startCapture(ctx, 'email_delivery', 'Enter your email to receive:', {
    validate: async (input) => isValidEmail(input) ? null : 'Invalid email.',
    onSuccess: async (ctx, email) => {
      await prisma.user.update({ where: { id: order.userId }, data: { email } });

      const success = await sendPurchaseEmail({
        to: email,
        orderId: order.id,
        productName: order.product.name,
        price: parseFloat(order.unitPrice.toString()),
        quantity: order.quantity,
        total: parseFloat(order.totalPrice.toString()),
        paymentMethod: order.payment?.method || 'SALDO',
        date: order.createdAt,
        validity: order.expiresAt?.toLocaleDateString('pt-BR') || '',
        description: order.product.description || '',
        loginData: order.stockUnits.map(u => u.content).join('\n'),
      });

      if (success) {
        await ctx.editMessageText('📧 Email sent successfully!');
      } else {
        await ctx.editMessageText('❌ Failed to send email.');
      }
    },
  });
}
