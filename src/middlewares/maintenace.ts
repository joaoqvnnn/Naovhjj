import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from '../admin/userManagement'; // ajuste se necessário

// Middleware de manutenção
export async function maintenanceMiddleware(ctx: Context, next: () => Promise<void>) {
  const setting = await prisma.setting.findUnique({ where: { key: 'maintenance' } });
  const maintenanceEnabled = setting?.value?.enabled || false;

  if (!maintenanceEnabled) return next();

  // Se usuário é admin, permite acesso
  if (await isAdmin(ctx)) return next();

  // Busca mensagem de manutenção
  const template = await prisma.messageTemplate.findUnique({ where: { key: 'manutencao' } });
  const text = template?.text || '🔧 Bot em manutenção no momento. Tente novamente mais tarde.';

  // Se for comando ou callback, responde com a mensagem
  if (ctx.message) {
    await ctx.reply(text);
  } else if (ctx.callbackQuery) {
    await ctx.answerCbQuery(text);
  }
  // Não chama next() -> bloqueia
}

// Comando /termos
export async function cmdTermos(ctx: Context) {
  const template = await prisma.messageTemplate.findUnique({ where: { key: 'termos' } });
  const text = template?.text || 'Termos de uso não configurados.';
  await ctx.reply(text);
}
