import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { logAction } from '../services/logger';

// Verifica atualizações (versão do bot e status)
export async function checkUpdates(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const version = '4.1.0'; // pode vir de uma config
  const lastLog = await prisma.log.findFirst({ orderBy: { createdAt: 'desc' } });
  const lastActivity = lastLog?.createdAt?.toLocaleString('pt-BR') || 'Nenhuma atividade registrada.';

  const text = `🔄 ATUALIZAÇÕES\n\n` +
    `Versão atual: ${version}\n` +
    `Última atividade registrada: ${lastActivity}\n\n` +
    `O sistema está atualizado.`;

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'admin_menu_updates' }]],
    },
  });
}

// Visualiza logs do sistema (últimos 20)
export async function viewSystemLogs(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const logs = await prisma.log.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { user: { select: { username: true, telegramId: true } } },
  });

  if (!logs.length) {
    await ctx.editMessage('📜 Nenhum log registrado ainda.', {
      reply_markup: { inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'admin_menu_updates' }]] },
    });
    return;
  }

  const text = logs.map(log => {
    const user = log.user ? `${log.user.username || log.user.telegramId}` : 'Sistema';
    return `#${log.id} | ${log.createdAt.toLocaleString('pt-BR')} | ${user} | ${log.action}`;
  }).join('\n');

  await ctx.editMessage(`📜 LOGS DO SISTEMA (últimos 20)\n\n${text}`, {
    reply_markup: {
      inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'admin_menu_updates' }]],
    },
  });
}

// Limpa dados antigos (logs com mais de X dias, pagamentos expirados, etc.)
export async function cleanOldData(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  // Define limite de dias (pode ser configurável)
  const days = 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Exclui logs antigos
  const deletedLogs = await prisma.log.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });

  // Exclui pagamentos expirados antigos (opcional)
  const deletedExpiredPayments = await prisma.payment.deleteMany({
    where: { status: 'EXPIRED', createdAt: { lt: cutoff } },
  });

  await logAction({
    action: 'CLEAN_OLD_DATA',
    details: { deletedLogs: deletedLogs.count, deletedExpiredPayments: deletedExpiredPayments.count },
  });

  await ctx.editMessage(
    `🧹 LIMPEZA CONCLUÍDA\n\n` +
    `Logs excluídos: ${deletedLogs.count}\n` +
    `Pagamentos expirados excluídos: ${deletedExpiredPayments.count}\n` +
    `(dados anteriores a ${days} dias)`,
    {
      reply_markup: {
        inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'admin_menu_updates' }]],
      },
    }
  );
}
