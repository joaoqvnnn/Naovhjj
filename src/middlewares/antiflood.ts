import { Context } from '../types/context';
import prisma from '../database';

interface RateLimitConfig {
  maxMessages: number;      // máximo de mensagens no intervalo
  intervalSeconds: number;  // intervalo em segundos
  blockDurationSeconds: number; // duração do bloqueio temporário
  maxBlocksBeforePermanent: number; // após quantos bloqueios vira permanente
}

// Mapa em memória para rastrear atividades (pode ser substituído por Redis)
const userActivity = new Map<number, { count: number; resetAt: number; blockedUntil?: number; blockCount: number }>();

async function getConfig(): Promise<RateLimitConfig> {
  const config = await prisma.setting.findUnique({ where: { key: 'antiflood' } });
  if (config) {
    return config.value as unknown as RateLimitConfig;
  }
  // Valores padrão
  return {
    maxMessages: 10,
    intervalSeconds: 10,
    blockDurationSeconds: 60,
    maxBlocksBeforePermanent: 3,
  };
}

async function isUserBlockedPermanently(userId: number): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(userId) },
  });
  return user?.status === 'BLOCKED';
}

export async function antifloodMiddleware(ctx: Context, next: () => Promise<void>) {
  if (!ctx.from) return next();
  const userId = ctx.from.id;

  // Verifica bloqueio permanente
  if (await isUserBlockedPermanently(userId)) {
    // Usuário bloqueado permanentemente: ignora ação
    return;
  }

  const cfg = await getConfig();
  const now = Date.now();

  // Inicializa registro se não existir
  if (!userActivity.has(userId)) {
    userActivity.set(userId, { count: 0, resetAt: now + cfg.intervalSeconds * 1000, blockCount: 0 });
  }

  const activity = userActivity.get(userId)!;

  // Verifica se está em bloqueio temporário
  if (activity.blockedUntil && now < activity.blockedUntil) {
    // Ainda bloqueado
    const remaining = Math.ceil((activity.blockedUntil - now) / 1000);
    try {
      await ctx.reply(`⚠️ Você está temporariamente bloqueado devido a muitas ações. Tente novamente em ${remaining} segundos.`);
    } catch (e) {
      // ignora
    }
    return;
  } else if (activity.blockedUntil && now >= activity.blockedUntil) {
    // Bloqueio expirou, resetar contagem
    activity.blockedUntil = undefined;
    activity.count = 0;
    activity.resetAt = now + cfg.intervalSeconds * 1000;
  }

  // Verifica se o intervalo de contagem expirou
  if (now > activity.resetAt) {
    activity.count = 0;
    activity.resetAt = now + cfg.intervalSeconds * 1000;
  }

  // Incrementa contagem
  activity.count++;

  // Verifica se excedeu o limite
  if (activity.count > cfg.maxMessages) {
    // Aplica bloqueio temporário
    activity.blockedUntil = now + cfg.blockDurationSeconds * 1000;
    activity.blockCount++;

    // Se atingiu o máximo de bloqueios, bloqueia permanentemente
    if (activity.blockCount >= cfg.maxBlocksBeforePermanent) {
      await prisma.user.update({
        where: { telegramId: BigInt(userId) },
        data: { status: 'BLOCKED' },
      });
      await ctx.reply('🚫 Você foi bloqueado permanentemente por abuso do bot.');
      return;
    }

    await ctx.reply(`⚠️ Muitas ações em pouco tempo. Você está bloqueado por ${cfg.blockDurationSeconds} segundos.`);
    return;
  }

  // Continua para o próximo middleware
  await next();
}
