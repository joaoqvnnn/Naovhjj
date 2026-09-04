import { Context } from '../types/context';
import prisma from '../database';
import { startCapture } from '../middlewares/capture';
import { normalizePhone } from '../utils/phoneValidation';
import { sendWhatsAppButton } from '../services/whatsappApi';

export async function startWhatsAppDelivery(ctx: Context, orderId: number) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: true, product: true, stockUnits: true },
  });
  if (!order) return ctx.editMessage('Pedido não encontrado.');

  // Se já tem WhatsApp válido, envia direto
  if (order.user.whatsapp && normalizePhone(order.user.whatsapp)) {
    const normalized = normalizePhone(order.user.whatsapp)!;
    const messageText = `🛍️ *Compra realizada!*\n\n` +
      `Produto: ${order.product.name}\n` +
      `Valor: R$ ${order.totalPrice}\n` +
      `Data: ${order.createdAt.toLocaleDateString('pt-BR')}\n` +
      `Clique no botão abaixo para ativar e receber seu acesso:`;

    await sendWhatsAppButton(normalized, messageText, [
      { type: 'reply', displayText: 'Ativar', id: 'ativar' },
    ]);

    await prisma.order.update({
      where: { id: order.id },
      data: { whatsapp: normalized, deliveryMethod: 'WHATSAPP' },
    });

    await ctx.editMessage(`✅ Compra enviada para o WhatsApp com botão de ativação!`);
    return;
  }

  // Captura número com validação flexível
  await startCapture(ctx, 'whatsapp_entrega', '📱 Digite seu número de WhatsApp (com DDD, pode incluir +55):', {
    validate: async (input) => {
      const normalized = normalizePhone(input);
      if (!normalized) {
        return '❌ Número inválido. Use formatos como +55 (44) 99999-9999 ou 44999999999.';
      }
      return null;
    },
    onSuccess: async (ctx, phone) => {
      const normalized = normalizePhone(phone)!;
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
