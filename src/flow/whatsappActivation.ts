import prisma from '../database';
import bcrypt from 'bcryptjs';
import { sendWhatsAppText } from '../services/whatsappApi';
import { logAction } from '../services/logger';

// Estado simples em memória (em produção, usar Redis)
const activationState = new Map<string, { orderId?: number; awaitingPassword: boolean }>();

// Inicia o fluxo de ativação quando o cliente envia "Ativar"
export async function handleWhatsAppActivationFlow(remoteJid: string, messageText: string) {
  const lower = messageText.toLowerCase().trim();

  // Verifica se é comando de ativação
  if (lower === 'ativar') {
    // Encontra o pedido mais recente entregue por WhatsApp para este número
    const order = await prisma.order.findFirst({
      where: {
        whatsapp: remoteJid.replace(/\D/g, ''),
        status: 'PAID',
      },
      orderBy: { createdAt: 'desc' },
      include: { user: true, stockUnits: true },
    });

    if (!order) {
      await sendWhatsAppText(remoteJid, 'Nenhum produto pendente de ativação encontrado.');
      return;
    }

    // Marca estado de espera de senha
    activationState.set(remoteJid, { orderId: order.id, awaitingPassword: true });

    // Pede a senha
    await sendWhatsAppText(remoteJid, '🔐 Digite a senha para liberar seu produto:');
    return;
  }

  // Se está aguardando senha
  const state = activationState.get(remoteJid);
  if (state && state.awaitingPassword && state.orderId) {
    // Valida a senha
    const order = await prisma.order.findUnique({
      where: { id: state.orderId },
      include: { user: true, product: true, stockUnits: true },
    });

    if (!order) {
      await sendWhatsAppText(remoteJid, 'Pedido não encontrado.');
      activationState.delete(remoteJid);
      return;
    }

    const valid = await bcrypt.compare(messageText, order.user.passwordHash || '');
    if (!valid) {
      await sendWhatsAppText(remoteJid, '❌ Senha incorreta. Tente novamente.');
      return; // mantém estado
    }

    // Senha correta: libera o produto
    const conteudo = order.stockUnits.map(u => u.content).join('\n');
    const liberacao = `✅ Produto liberado!\n\n` +
      `📦 Produto: ${order.product.name}\n` +
      `🔑 Dados de acesso:\n${conteudo}\n\n` +
      `Obrigado por comprar!`;

    await sendWhatsAppText(remoteJid, liberacao);

    // Marca como entregue
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'DELIVERED', deliveredAt: new Date() },
    });

    await logAction({
      action: 'WHATSAPP_ACTIVATION_SUCCESS',
      userId: order.userId,
      details: { orderId: order.id, remoteJid },
    });

    activationState.delete(remoteJid);
  }
}
