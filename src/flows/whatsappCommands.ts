import prisma from '../database';
import { sendWhatsAppText } from '../services/whatsappApi';
import { formatCurrency, formatDate } from '../utils/format';

// Processa comandos de texto no WhatsApp
export async function handleWhatsAppCommands(remoteJid: string, messageText: string) {
  const lower = messageText.toLowerCase().trim();

  // Comando: histórico / compras / pedidos
  if (lower === 'historico' || lower === 'compras' || lower === 'pedidos') {
    await sendPurchaseHistory(remoteJid);
    return;
  }

  // Comando: saldo
  if (lower === 'saldo' || lower === 'carteira') {
    await sendBalance(remoteJid);
    return;
  }

  // Comando: ajuda
  if (lower === 'ajuda' || lower === 'menu') {
    await sendHelp(remoteJid);
    return;
  }
}

// Envia histórico de compras do usuário
async function sendPurchaseHistory(remoteJid: string) {
  // Procura usuário pelo número de WhatsApp (normalizado)
  const user = await prisma.user.findFirst({
    where: { whatsapp: remoteJid.replace(/\D/g, '') },
    include: {
      orders: {
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { product: true },
      },
    },
  });

  if (!user) {
    await sendWhatsAppText(remoteJid, 'Você ainda não cadastrou seu WhatsApp na loja. Use /start no Telegram primeiro.');
    return;
  }

  if (!user.orders.length) {
    await sendWhatsAppText(remoteJid, 'Você ainda não tem compras registradas.');
    return;
  }

  let text = '🛍️ *Últimas compras:*\n\n';
  for (const order of user.orders) {
    text += `📦 ${order.product.name}\n`;
    text += `💰 Valor: ${formatCurrency(order.totalPrice)}\n`;
    text += `📅 Data: ${formatDate(order.createdAt)}\n`;
    text += `🆔 Pedido: ${order.id}\n\n`;
  }

  await sendWhatsAppText(remoteJid, text);
}

// Envia saldo do usuário
async function sendBalance(remoteJid: string) {
  const user = await prisma.user.findFirst({
    where: { whatsapp: remoteJid.replace(/\D/g, '') },
  });

  if (!user) {
    await sendWhatsAppText(remoteJid, 'Usuário não encontrado. Cadastre seu WhatsApp na loja.');
    return;
  }

  await sendWhatsAppText(remoteJid, `💰 Saldo: ${formatCurrency(user.balance)}`);
}

// Envia menu de ajuda
async function sendHelp(remoteJid: string) {
  const helpText = `🤖 Comandos disponíveis:\n\n` +
    `- "historico" ou "compras" → ver histórico de compras\n` +
    `- "saldo" ou "carteira" → ver saldo\n` +
    `- "ajuda" ou "menu" → ver este menu`;
  await sendWhatsAppText(remoteJid, helpText);
}
