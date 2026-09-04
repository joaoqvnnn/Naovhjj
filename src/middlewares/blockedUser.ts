import { Context } from '../types/context';
import prisma from '../database';

// Middleware para bloquear usuários com status BLOCKED
export async function blockedUserMiddleware(ctx: Context, next: () => Promise<void>) {
  if (!ctx.from) return next();

  const userId = ctx.from.id;
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(userId) },
    select: { status: true },
  });

  if (user?.status === 'BLOCKED') {
    // Usuário bloqueado: não responde ou envia mensagem padrão
    // Podemos enviar uma mensagem informando que ele está bloqueado (configurável)
    const blockMessage = await prisma.messageTemplate.findUnique({
      where: { key: 'usuario_bloqueado' },
    });
    const text = blockMessage?.text || '🚫 Você está bloqueado e não pode utilizar o bot.';
    try {
      await ctx.reply(text);
    } catch (e) {
      // ignora
    }
    return; // interrompe a cadeia
  }

  await next();
}

// Função auxiliar para verificar se um usuário está bloqueado (para uso em notificações)
export async function isUserBlocked(telegramId: number | bigint): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(telegramId) },
    select: { status: true },
  });
  return user?.status === 'BLOCKED';
}
