import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';

export async function listAdmins(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const admins = await prisma.user.findMany({
    where: { role: { in: ['OWNER', 'ADMIN', 'FINANCE', 'STOCK', 'SUPPORT', 'ANALYST'] } },
    select: { id: true, telegramId: true, username: true, role: true },
  });
  const text = admins.map(a => `#${a.id} - ${a.username || a.telegramId} - ${a.role}`).join('\n') || 'Nenhum admin.';

  await ctx.editMessage(`👑 Administradores:\n\n${text}`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '➕ Adicionar ADM', callback_data: 'admin_add_adm' }],
        [{ text: '➖ Remover ADM', callback_data: 'admin_remove_adm' }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_menu_config' }],
      ],
    },
  });
}

export async function addAdmin(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'admin_add_id', 'Digite o Telegram ID do novo administrador:', {
    validate: async (input) => /^\d+$/.test(input) ? null : 'ID inválido.',
    onSuccess: async (ctx, telegramId) => {
      const userId = parseInt(telegramId);
      const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
      if (!user) {
        await ctx.editMessage('Usuário não encontrado no bot.');
        return;
      }
      await prisma.user.update({ where: { id: user.id }, data: { role: 'ADMIN' } });
      await ctx.editMessage('✅ Administrador adicionado.');
      await listAdmins(ctx);
    },
  });
}

export async function removeAdmin(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'admin_remove_id', 'Digite o Telegram ID do admin a remover:', {
    validate: async (input) => /^\d+$/.test(input) ? null : 'ID inválido.',
    onSuccess: async (ctx, telegramId) => {
      const userId = parseInt(telegramId);
      const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
      if (!user) {
        await ctx.editMessage('Usuário não encontrado.');
        return;
      }
      await prisma.user.update({ where: { id: user.id }, data: { role: 'USER' } });
      await ctx.editMessage('✅ Administrador removido.');
      await listAdmins(ctx);
    },
  });
}
