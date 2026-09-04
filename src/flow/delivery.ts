import { Context } from '../types/context';
import prisma from '../database';
import { startCapture } from '../middlewares/capture';
import { isValidEmail, isValidWhatsApp, normalizeWhatsApp } from '../utils/format';
import { sendPurchaseEmail } from '../services/email';
import { sendWhatsAppDelivery } from '../services/whatsapp';
import { formatCurrency } from '../utils/format';

// Inicia entrega por e-mail
export async function startEmailDelivery(ctx: Context, orderId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true, product: true, stockUnits: true },
  });
  if (!order) {
    await ctx.editMessage('Pedido não encontrado.');
    return;
  }

  // Se usuário já tem e-mail cadastrado, envia direto
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
      await ctx.editMessage(`📧 E-mail enviado para ${order.user.email} com sucesso!`);
    } else {
      await ctx.editMessage('❌ Falha ao enviar e-mail. Tente novamente ou use outro método.');
    }
    return;
  }

  // Caso não tenha e-mail, inicia captura
  await startCapture(ctx, 'email_entrega', '📧 Digite seu e-mail para receber a compra:', {
    validate: async (input) => {
      if (!isValidEmail(input)) return '❌ E-mail inválido. Digite novamente.';
      return null;
    },
    onSuccess: async (ctx, email) => {
      // Salva e-mail no usuário
      await prisma.user.update({
        where: { id: order.userId },
        data: { email },
      });
      // Envia e-mail
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
        await ctx.editMessage(`📧 E-mail enviado para ${email} com sucesso!`);
      } else {
        await ctx.editMessage('❌ Falha ao enviar e-mail. Tente novamente.');
      }
    },
  });
}

// Inicia entrega por WhatsApp
export async function startWhatsAppDelivery(ctx: Context, orderId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true, product: true, stockUnits: true },
  });
  if (!order) {
    await ctx.editMessage('Pedido não encontrado.');
    return;
  }

  // Se usuário já tem WhatsApp cadastrado, envia direto
  if (order.user.whatsapp && isValidWhatsApp(order.user.whatsapp)) {
    const normalized = normalizeWhatsApp(order.user.whatsapp);
    const success = await sendWhatsAppDelivery({
      to: normalized!,
      orderId: order.id,
      productName: order.product.name,
      price: parseFloat(order.unitPrice.toString()),
      quantity: order.quantity,
      total: parseFloat(order.totalPrice.toString()),
      date: order.createdAt,
      validity: order.expiresAt?.toLocaleDateString('pt-BR') || '',
      description: order.product.description || '',
      loginData: order.stockUnits.map(u => u.content).join('\n'),
      imageUrl: order.product.imageUrl || undefined,
    });
    if (success) {
      await ctx.editMessage(`📱 Compra enviada para o WhatsApp ${normalized}!`);
    } else {
      await ctx.editMessage('❌ Falha ao enviar WhatsApp. Tente novamente.');
    }
    return;
  }

  // Captura número
  await startCapture(ctx, 'whatsapp_entrega', '📱 Digite seu número de WhatsApp (com DDD):', {
    validate: async (input) => {
      const normalized = normalizeWhatsApp(input);
      if (!normalized) return '❌ Número inválido. Digite no formato DDI+DDD+número (ex: 5544999999999).';
      return null;
    },
    onSuccess: async (ctx, phone) => {
      const normalized = normalizeWhatsApp(phone)!;
      // Salva no usuário
      await prisma.user.update({
        where: { id: order.userId },
        data: { whatsapp: normalized },
      });
      // Envia WhatsApp
      const success = await sendWhatsAppDelivery({
        to: normalized,
        orderId: order.id,
        productName: order.product.name,
        price: parseFloat(order.unitPrice.toString()),
        quantity: order.quantity,
        total: parseFloat(order.totalPrice.toString()),
        date: order.createdAt,
        validity: order.expiresAt?.toLocaleDateString('pt-BR') || '',
        description: order.product.description || '',
        loginData: order.stockUnits.map(u => u.content).join('\n'),
        imageUrl: order.product.imageUrl || undefined,
      });
      if (success) {
        await ctx.editMessage(`📱 Compra enviada para o WhatsApp ${normalized}!`);
      } else {
        await ctx.editMessage('❌ Falha ao enviar WhatsApp. Tente novamente.');
      }
    },
  });
}
