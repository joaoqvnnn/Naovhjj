import { Context } from '../types/context';
import prisma from '../database';
import { startCapture } from '../middlewares/capture';
import { isValidWhatsApp, normalizeWhatsApp } from '../utils/format';
import { sendWhatsAppButton } from '../services/whatsappApi';
import { sendPurchaseEmail } from '../services/email';

// ... (mantém as funções de e-mail)

// Atualiza entrega por WhatsApp para usar botão "Ativar"
export async function startWhatsAppDelivery(ctx: Context, orderId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true, product: true, stockUnits: true },
  });
  if (!order) return ctx.editMessage('Pedido não encontrado.');

  // Se já tem WhatsApp, envia direto
  if (order.user.whatsapp && isValidWhatsApp(order.user.whatsapp)) {
    const normalized = normalizeWhatsApp(order.user.whatsapp)!;
    const messageText = `🛍️ *Compra realizada!*\n\n` +
      `Produto: ${order.product.name}\n` +
      `Valor: R$ ${order.totalPrice}\n` +
      `Data: ${order.createdAt.toLocaleDateString('pt-BR')}\n` +
      `Clique no botão abaixo para ativar e receber seu acesso:`;

    // Envia com botão
    await sendWhatsAppButton(normalized, messageText, [
      { type: 'reply', displayText: 'Ativar', id: 'ativar' },
    ]);

    // Atualiza pedido com o número
    await prisma.order.update({
      where: { id: order.id },
      data: { whatsapp: normalized, deliveryMethod: 'WHATSAPP' },
    });

    await ctx.editMessage(`✅ Compra enviada para o WhatsApp com botão de ativação!`);
    return;
  }

  // Captura número e envia com botão
  await startCapture(ctx, 'whatsapp_entrega', '📱 Digite seu número de WhatsApp (com DDD):', {
    validate: async (input) => {
      const normalized = normalizeWhatsApp(input);
      if (!normalized) return 'Número inválido.';
      return null;
    },
    onSuccess: async (ctx, phone) => {
      const normalized = normalizeWhatsApp(phone)!;
      await prisma.user.update({
        where: { id: order.userId },
        data: { whatsapp: normalized },
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { whatsapp: normalized, deliveryMethod: 'WHATSAPP' },
      });

      const messageText = `🛍️ *Compra realizada!*\n\n` +
        `Produto: ${order.product.name}\n` +
        `Valor: R$ ${order.totalPrice}\n` +
        `Data: ${order.createdAt.toLocaleDateString('pt-BR')}\n` +
        `Clique no botão abaixo para ativar e receber seu acesso:`;

      await sendWhatsAppButton(normalized, messageText, [
        { type: 'reply', displayText: 'Ativar', id: 'ativar' },
      ]);

      await ctx.editMessage(`✅ Compra enviada para o WhatsApp com botão de ativação!`);
    },
  });
}
