import { Context } from '../types/context';
import prisma from '../database';

interface RateLimitEntry {
  count: number;
  resetAt: number;
  blockedUntil?: number;
}

// Limites padrão (podem ser sobrescritos por Setting)
const DEFAULT_LIMITS: Record<string, { max: number; intervalSec: number; blockSec: number }> = {
  pix_generate: { max: 5, intervalSec: 60, blockSec: 300 },
  giftcard_attempt: { max: 5, intervalSec: 60, blockSec: 300 },
  password_attempt: { max: 5, intervalSec: 60, blockSec: 300 },
  withdrawal_attempt: { max: 3, intervalSec: 60, blockSec: 600 },
  coupon_activate: { max: 3, intervalSec: 60, blockSec: 300 },
};

// Mapa em memória: userId -> ação -> RateLimitEntry
const userLimits = new Map<number, Map<string, RateLimitEntry>>();

async function getConfig(action: string): Promise<{ max: number; intervalSec: number; blockSec: number }> {
  const setting = await prisma.setting.findUnique({ where: { key: `ratelimit_${action}` } });
  if (setting && setting.value) {
    return setting.value as { max: number; intervalSec: number; blockSec: number };
  }
  return DEFAULT_LIMITS[action] || { max: 10, intervalSec: 60, blockSec: 300 };
}

/**
 * Verifica e incrementa o limite para uma ação específica.
 * Retorna true se o usuário estiver bloqueado (não deve prosseguir),
 * ou false se a ação pode continuar.
 */
export async function actionRateLimit(ctx: Context, action: string): Promise<boolean> {
  const userId = ctx.from?.id;
  if (!userId) return false; // não bloqueia se não houver ID

  const config = await getConfig(action);
  const now = Date.now();

  if (!userLimits.has(userId)) {
    userLimits.set(userId, new Map());
  }
  const actionMap = userLimits.get(userId)!;

  if (!actionMap.has(action)) {
    actionMap.set(action, { count: 0, resetAt: now + config.intervalSec * 1000 });
  }

  const entry = actionMap.get(action)!;

  // Verifica bloqueio temporário
  if (entry.blockedUntil && now < entry.blockedUntil) {
    const remaining = Math.ceil((entry.blockedUntil - now) / 1000);
    // Busca mensagem personalizada (ou usa padrão)
    const template = await prisma.messageTemplate.findUnique({ where: { key: 'rate_limit_blocked' } });
    const message = template?.text || `Muitas tentativas. Aguarde ${remaining} segundos.`;
    await ctx.reply(message.replace('{seconds}', String(remaining)));
    return true;
  } else if (entry.blockedUntil && now >= entry.blockedUntil) {
    // Bloqueio expirado, reseta
    entry.blockedUntil = undefined;
    entry.count = 0;
    entry.resetAt = now + config.intervalSec * 1000;
  }

  // Reset por intervalo
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + config.intervalSec * 1000;
  }

  entry.count++;
  if (entry.count > config.max) {
    entry.blockedUntil = now + config.blockSec * 1000;
    const template = await prisma.messageTemplate.findUnique({ where: { key: 'rate_limit_blocked' } });
    const message = template?.text || `Você excedeu o limite de tentativas. Bloqueado por ${config.blockSec} segundos.`;
    await ctx.reply(message.replace('{seconds}', String(config.blockSec)));
    return true;
  }

  return false; // permitido
}

// Limpa o mapa para evitar vazamento de memória (pode ser chamado periodicamente)
export function clearRateLimits() {
  userLimits.clear();
}
