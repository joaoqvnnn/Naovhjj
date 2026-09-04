interface UserActivity {
  count: number;
  resetAt: number;
  blockedUntil?: number;
}

// Configurações padrão (podem ser sobrescritas via Setting)
const DEFAULT_LIMIT = 10;          // máximo de mensagens no intervalo
const DEFAULT_INTERVAL_SEC = 30;   // intervalo em segundos
const DEFAULT_BLOCK_SEC = 300;     // duração do bloqueio em segundos

// Mapa em memória: remoteJid -> UserActivity
const activityMap = new Map<string, UserActivity>();

// Obtém configurações do banco (se existirem)
async function getAntiFloodConfig() {
  const { prisma } = await import('../database');
  const setting = await prisma.setting.findUnique({ where: { key: 'whatsapp_antiflood' } });
  if (setting && setting.value) {
    return setting.value as { max: number; intervalSec: number; blockSec: number };
  }
  return { max: DEFAULT_LIMIT, intervalSec: DEFAULT_INTERVAL_SEC, blockSec: DEFAULT_BLOCK_SEC };
}

/**
 * Verifica se o usuário está bloqueado ou deve ser bloqueado por flood.
 * Retorna true se bloqueado (não processar mensagem), false se ok.
 */
export async function isBlockedByFlood(remoteJid: string): Promise<boolean> {
  const config = await getAntiFloodConfig();
  const now = Date.now();

  if (!activityMap.has(remoteJid)) {
    activityMap.set(remoteJid, { count: 0, resetAt: now + config.intervalSec * 1000 });
  }

  const activity = activityMap.get(remoteJid)!;

  // Verifica bloqueio temporário
  if (activity.blockedUntil && now < activity.blockedUntil) {
    return true; // ainda bloqueado
  } else if (activity.blockedUntil && now >= activity.blockedUntil) {
    // Bloqueio expirado, resetar contagem
    activity.blockedUntil = undefined;
    activity.count = 0;
    activity.resetAt = now + config.intervalSec * 1000;
  }

  // Reset por intervalo
  if (now > activity.resetAt) {
    activity.count = 0;
    activity.resetAt = now + config.intervalSec * 1000;
  }

  // Incrementa contagem
  activity.count++;

  // Verifica se excedeu
  if (activity.count > config.max) {
    activity.blockedUntil = now + config.blockSec * 1000;
    await sendBlockedMessage(remoteJid);
    return true;
  }

  return false;
}

// Envia mensagem de bloqueio ao usuário
async function sendBlockedMessage(remoteJid: string) {
  const { sendWhatsAppText } = await import('../services/whatsappApi');
  const message = '⚠️ Você foi temporariamente bloqueado por enviar muitas mensagens em sequência. Aguarde alguns minutos.';
  await sendWhatsAppText(remoteJid, message);
}

// Limpa o mapa (para evitar vazamento de memória)
export function clearActivity(remoteJid: string) {
  activityMap.delete(remoteJid);
}
