import axios from 'axios';
import prisma from '../database';
import { logAction } from './logger';
import { isBlockedByFlood } from '../middlewares/whatsappAntiFlood';

interface WhatsAppApiConfig {
  url: string;
  apikey: string;
  instance: string;
}

async function getConfig(): Promise<WhatsAppApiConfig | null> {
  const setting = await prisma.setting.findUnique({ where: { key: 'whatsapp_api' } });
  if (!setting) return null;
  return setting.value as WhatsAppApiConfig;
}

export async function sendWhatsAppText(to: string, text: string): Promise<boolean> {
  const config = await getConfig();
  if (!config) {
    console.log(`[WhatsApp Simulado] Para: ${to}\n${text}`);
    return true;
  }
  try {
    await axios.post(`${config.url}/message/sendText/${config.instance}`, {
      number: to,
      text,
    }, {
      headers: { apikey: config.apikey },
    });
    return true;
  } catch (error) {
    console.error('Erro ao enviar texto WhatsApp:', error);
    await logAction({ action: 'WHATSAPP_SEND_ERROR', details: { to, error: String(error) } });
    return false;
  }
}

export async function sendWhatsAppButton(to: string, text: string, buttons: Array<{ type: 'reply', displayText: string, id: string }>): Promise<boolean> {
  const config = await getConfig();
  if (!config) {
    console.log(`[WhatsApp Simulado] Para: ${to}\n${text}\nBotões: ${JSON.stringify(buttons)}`);
    return true;
  }
  try {
    await axios.post(`${config.url}/message/sendButtons/${config.instance}`, {
      number: to,
      text,
      buttons,
    }, {
      headers: { apikey: config.apikey },
    });
    return true;
  } catch (error) {
    console.error('Erro ao enviar botão WhatsApp:', error);
    await logAction({ action: 'WHATSAPP_SEND_ERROR', details: { to, error: String(error) } });
    return false;
  }
}

// Processa mensagens recebidas (chamado pelo webhook)
export async function handleIncomingWhatsAppMessage(data: any) {
  const remoteJid = data?.data?.key?.remoteJid;
  const fromMe = data?.data?.key?.fromMe;
  const messageText = data?.data?.message?.conversation || data?.data?.message?.extendedTextMessage?.text || '';

  if (fromMe || !remoteJid) return;

  // Verifica anti-flood antes de processar
  const blocked = await isBlockedByFlood(remoteJid);
  if (blocked) {
    console.log(`[AntiFlood] Mensagem de ${remoteJid} ignorada por bloqueio.`);
    return;
  }

  // Importa dinamicamente o fluxo de comandos/ativação
  const { handleWhatsAppActivationFlow } = await import('../flows/whatsappActivation');
  await handleWhatsAppActivationFlow(remoteJid, messageText);

  // Além da ativação, pode ter comandos de histórico, etc.
  const { handleWhatsAppCommands } = await import('../flows/whatsappCommands');
  await handleWhatsAppCommands(remoteJid, messageText);
}
