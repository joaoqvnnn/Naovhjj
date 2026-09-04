import axios from 'axios';
import config from '../config';
import prisma from '../database';
import { formatCurrency, formatDate, formatTime } from '../utils/format';

// Interface para dados da mensagem de entrega
interface WhatsAppDeliveryData {
  to: string; // número normalizado (ex: 5544999999999)
  orderId: number;
  productName: string;
  productEmoji?: string;
  price: number;
  quantity: number;
  total: number;
  date: Date;
  validity?: string;
  description?: string;
  loginData?: string; // conteúdo do produto
  imageUrl?: string;
}

// Função para enviar mensagem via WhatsApp
export async function sendWhatsAppDelivery(data: WhatsAppDeliveryData): Promise<boolean> {
  try {
    // Busca template personalizado
    const template = await prisma.messageTemplate.findUnique({
      where: { key: 'whatsapp_compra' },
    });

    let text = '';
    if (template) {
      text = template.text
        .replace(/\{produto\}/g, data.productName)
        .replace(/\{valor\}/g, formatCurrency(data.total))
        .replace(/\{data\}/g, formatDate(data.date))
        .replace(/\{hora\}/g, formatTime(data.date))
        .replace(/\{pedido_id\}/g, String(data.orderId))
        .replace(/\{quantidade\}/g, String(data.quantity))
        .replace(/\{validade\}/g, data.validity || '')
        .replace(/\{descricao\}/g, data.description || '')
        .replace(/\{login\}/g, data.loginData || '');
    } else {
      text = `✅ *Compra realizada!*\n\n` +
        `📦 Produto: ${data.productName}\n` +
        `💰 Valor: ${formatCurrency(data.total)}\n` +
        `📅 Data: ${formatDate(data.date)} ${formatTime(data.date)}\n` +
        `🆔 Pedido: ${data.orderId}\n` +
        (data.validity ? `⏳ Vencimento: ${data.validity}\n` : '') +
        (data.loginData ? `🔑 Dados: ${data.loginData}\n` : '') +
        `Obrigado!`;
    }

    // Verifica se temos uma URL de API de WhatsApp configurada
    const whatsappApiUrl = process.env.WHATSAPP_API_URL;
    if (!whatsappApiUrl) {
      // Sem API configurada, apenas registra a mensagem que seria enviada
      console.log(`📱 [WhatsApp Simulado] Para: ${data.to}\n${text}`);
      await prisma.log.create({
        data: {
          action: 'WHATSAPP_SIMULATED',
          details: { to: data.to, text, orderId: data.orderId },
        },
      });
      return true; // consideramos sucesso para não interromper o fluxo (em produção, deve ter API)
    }

    // Monta payload
    const payload: any = {
      number: data.to,
      text,
    };

    // Se houver imagem, inclui
    if (data.imageUrl) {
      payload.mediatype = 'image';
      payload.media = data.imageUrl;
      payload.caption = text;
      delete payload.text;
    }

    // Envia via API
    await axios.post(whatsappApiUrl, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar WhatsApp:', error);
    await prisma.log.create({
      data: {
        action: 'WHATSAPP_SEND_FAILED',
        details: { error: String(error), to: data.to, orderId: data.orderId },
      },
    });
    return false;
  }
}
