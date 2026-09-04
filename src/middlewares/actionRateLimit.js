import { Context } from '../types/context';
import prisma from '../database';

interface RateLimitEntry {
  count: number;
  resetAt: number;
  blockedUntil?: number;
}

// Limites padrão (podem ser sobrescritos por Setting)
const DEFAULT_LIMITS = {
  pix_generate: { max: 5, intervalSeconds: 60, blockSeconds: 300 },
  giftcard_attempt: { max: 5, intervalSeconds: 60, blockSeconds: 300 },
  password_attempt: { max: 5, intervalSeconds: 60, blockSeconds: 300 },
  withdrawal_attempt: { max: 3, intervalSeconds: 60, blockSeconds: 600 },
};

// Mapa em memória: userId -> action -> RateLimitEntry
const userLimits = new Map<number, Map<string, RateLimitEntry>>();

async function getConfig(action: string) {
  const setting = await prisma.setting.findUnique({ where: { key: `ratelimit_${action}` } });
  if (setting) return setting.value as typeof DEFAULT_LIMITS[typeof action];
  return DEFAULT_LIMITS[action] || { max: 10, intervalSeconds: 60, blockSeconds: 300 };
}

// Middleware que verifica e incrementa limite para uma ação
export async function actionRateLimit(ctx: Context, action: string): Promise<boolean> {
  const userId = ctx.from?.id;
  if (!userId) return false; // não bloqueia

  const config = await getConfig(action);
  const now = Date.now();

  if (!userLimits.has(userId)) {
    userLimits.set(userId, new Map());
  }
  const actionMap = userLimits.get(userId)!;

  if (!actionMap.has(action)) {
    actionMap.set(action, { count: 0, resetAt: now + config.intervalSeconds * 1000 });
  }

  const entry = actionMap.get(action)!;

  // Verifica bloqueio temporário
  if (entry.blockedUntil && now < entry.blockedUntil) {
    const remaining = Math.ceil((entry.blockedUntil - now) / 1000);
    await ctx.reply(`⚠️ Muitas tentativas. Aguarde ${remaining} segundos.`);
    return true; // bloqueado
  } else if (entry.blockedUntil && now >= entry.blockedUntil) {
    entry.blockedUntil = undefined;
    entry.count = 0;
    entry.resetAt = now + config.intervalSeconds * 1000;
  }

  // Reset por intervalo
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + config.intervalSeconds * 1000;
  }

  entry.count++;
  if (entry.count > config.max) {
    entry.blockedUntil = now + config.blockSeconds * 1000;
    await ctx.reply(`🚫 Você excedeu o limite de tentativas. Bloqueado por ${config.blockSeconds} segundos.`);
    return true;
  }

  return false; // permitido
}
