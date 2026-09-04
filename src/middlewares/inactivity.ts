import { Context } from '../types/context';
import prisma from '../database';

/**
 * Middleware de inatividade:
 * Verifica a última atividade do usuário e bloqueia ações se exceder o limite configurado.
 * O histórico e saldo permanecem salvos; apenas o acesso é restringido até reativação.
 */
export async function inactivityMiddleware(ctx: Context, next: () => Promise<void>) {
  if (!ctx.from) return next();

  const userId = ctx.from.id;
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(userId) },
    select: { lastActivityAt: true, status: true },
  });

  if (!user || user.status === 'BLOCKED') return next(); // já tratado

  // Obtém limite de inatividade (dias)
  const setting = await prisma.setting.findUnique({ where: { key: 'inactivity_days' } });
  const inactivityDays = setting ? parseInt(setting.value.toString()) : 90; // padrão 90 dias

  if (user.lastActivityAt) {
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - user.lastActivityAt.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays > inactivityDays) {
      // Usuário inativo: bloqueia ações (exceto mensagens de suporte)
      // Pode-se permitir apenas /start ou suporte, mas por enquanto bloqueia tudo.
      if (ctx.message && 'text' in ctx.message) {
        const text = ctx.message.text;
        // Se for /start, permite reativar
        if (text === '/start') {
          await prisma.user.update({
            where: { telegramId: BigInt(userId) },
            data: { lastActivityAt: new Date() },
          });
          return next();
        }
      }
      // Responde mensagem de inatividade
      await ctx.reply('Sua conta está inativa. Para reativar, envie /start.');
      return;
    }
  }

  // Atualiza última atividade a cada interação
  await prisma.user.update({
    where: { telegramId: BigInt(userId) },
    data: { lastActivityAt: new Date() },
  });

  return next();
}
