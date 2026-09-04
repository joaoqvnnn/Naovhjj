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

  if (!order) return ctx.editMessageText('Pedido não encontrado.');

  if (order.user.whatsapp && normalizePhone(order.user.whatsapp)) {
    const normalized = normalizePhone(order.user.whatsapp)!;
    const messageText = `🛍️ *Compra realizada!*\n\n` +
      `Produto: ${order.product.name}\n` +
      `Valor: R$ ${order.totalPrice}\n` +
      `Data: ${order.createdAt.toLocaleDateString('pt-BR')}\n` +
      `Clique no botão abaixo para ativar:`;

    await sendWhatsAppButton(normalized, messageText, [
      { type: 'reply', displayText: 'Ativar', id: 'ativar' },
    ]);

    await ctx.editMessageText('✅ Compra enviada para o WhatsApp!');
    return;
  }

  await startCapture(ctx, 'whatsapp_entrega', 'Digite seu número de WhatsApp (com DDD):', {
    validate: async (input) => normalizePhone(input) ? null : 'Número inválido.',
    onSuccess: async (ctx, phone) => {
      const normalized = normalizePhone(phone)!;
      await prisma.user.update({ where: { id: order.userId }, data: { whatsapp: normalized } });
      await prisma.order.update({ where: { id: orderId }, data: { whatsapp: normalized, deliveryMethod: 'WHATSAPP' } });

      const messageText = `🛍️ *Compra realizada!*\n\n` +
        `Produto: ${order.product.name}\n` +
        `Valor: R$ ${order.totalPrice}\n` +
        `Data: ${order.createdAt.toLocaleDateString('pt-BR')}\n` +
        `Clique no botão abaixo para ativar:`;

      await sendWhatsAppButton(normalized, messageText, [
        { type: 'reply', displayText: 'Ativar', id: 'ativar' },
      ]);

      await ctx.editMessageText('✅ Compra enviada para o WhatsApp!');
    },
  });
}

export async function startEmailDelivery(ctx: Context, orderId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true, product: true, stockUnits: true },
  });

  if (!order) return ctx.editMessageText('Pedido não encontrado.');

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
      await ctx.editMessageText('📧 E-mail enviado com sucesso!');
    } else {
      await ctx.editMessageText('❌ Falha ao enviar e-mail.');
    }
    return;
  }

  await startCapture(ctx, 'email_entrega', 'Digite seu e-mail para receber:', {
    validate: async (input) => isValidEmail(input) ? null : 'E-mail inválido.',
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
        await ctx.editMessageText('📧 E-mail enviado com sucesso!');
      } else {
        await ctx.editMessageText('❌ Falha ao enviar e-mail.');
      }
    },
  });
}
