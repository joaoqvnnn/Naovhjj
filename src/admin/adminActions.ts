import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';
import { logAction } from '../services/logger';

// Lista administradores
export async function listAdmins(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const admins = await prisma.user.findMany({
    where: { role: { in: ['OWNER', 'ADMIN', 'FINANCE', 'STOCK', 'SUPPORT', 'ANALYST'] } },
    select: { id: true, telegramId: true, username: true, role: true },
  });
  const text = admins.map(a => `#${a.id} - ${a.username || a.telegramId} - ${a.role}`).join('\n') || 'Nenhum admin.';
  await ctx.editMessage(`👑 Administradores:\n\n${text}`, {
    reply_markup: {
      inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'admin_config' }]],
    },
  });
}

// Adiciona administrador
export async function addAdmin(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'admin_add_id', 'Digite o Telegram ID do novo administrador:', {
    validate: async (input) => {
      if (!/^\d+$/.test(input)) return 'ID inválido.';
      return null;
    },
    onSuccess: async (ctx, telegramId) => {
      const userId = parseInt(telegramId);
      const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
      if (!user) return ctx.editMessage('Usuário não encontrado no bot.');

      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'ADMIN' },
      });
      await logAction({ action: 'ADMIN_ADDED', userId: user.id, details: { by: ctx.from?.id } });
      await ctx.editMessage(`✅ Usuário ${telegramId} agora é administrador.`);
    },
  });
}

// Remove administrador
export async function removeAdmin(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'admin_remove_id', 'Digite o Telegram ID do admin a remover:', {
    validate: async (input) => {
      if (!/^\d+$/.test(input)) return 'ID inválido.';
      return null;
    },
    onSuccess: async (ctx, telegramId) => {
      const userId = parseInt(telegramId);
      const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
      if (!user) return ctx.editMessage('Usuário não encontrado.');

      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'USER' },
      });
      await logAction({ action: 'ADMIN_REMOVED', userId: user.id, details: { by: ctx.from?.id } });
      await ctx.editMessage(`✅ Usuário ${telegramId} removido dos administradores.`);
    },
  });
}
