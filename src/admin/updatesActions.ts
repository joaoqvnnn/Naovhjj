import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';

export async function checkUpdates(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const version = '4.1.0';
  const lastLog = await prisma.log.findFirst({ orderBy: { createdAt: 'desc' } });
  const lastActivity = lastLog?.createdAt?.toLocaleString('pt-BR') || 'Nenhuma atividade.';

  await ctx.editMessage(`🔄 Atualizações\n\nVersão: ${version}\nÚltima atividade: ${lastActivity}\n\nSistema atualizado.`, {
    reply_markup: { inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'admin_menu_updates' }]] },
  });
}

export async function viewSystemLogs(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const logs = await prisma.log.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { user: { select: { username: true, telegramId: true } } },
  });

  if (!logs.length) {
    await ctx.editMessage('📜 Nenhum log registrado.', {
      reply_markup: { inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'admin_menu_updates' }]] },
    });
    return;
  }

  const text = logs.map(log => {
    const user = log.user ? `${log.user.username || log.user.telegramId}` : 'Sistema';
    return `#${log.id} | ${log.createdAt.toLocaleString('pt-BR')} | ${user} | ${log.action}`;
  }).join('\n');

  await ctx.editMessage(`📜 Logs do Sistema (últimos 20)\n\n${text}`, {
    reply_markup: { inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'admin_menu_updates' }]] },
  });
}

export async function cleanOldData(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const days = 30;
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const deletedLogs = await prisma.log.deleteMany({ where: { createdAt: { lt: cutoff } } });
  const deletedExpiredPayments = await prisma.payment.deleteMany({ where: { status: 'EXPIRED', createdAt: { lt: cutoff } } });

  await ctx.editMessage(`🧹 Limpeza concluída\n\nLogs excluídos: ${deletedLogs.count}\nPagamentos expirados: ${deletedExpiredPayments.count}`, {
    reply_markup: { inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'admin_menu_updates' }]] },
  });
}

export async function backupConfig(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const settings = await prisma.setting.findMany();
  const templates = await prisma.messageTemplate.findMany();
  const buttons = await prisma.buttonConfig.findMany();

  const backup = { settings, templates, buttons, exportedAt: new Date().toISOString() };
  const bot = (await import('../bot')).default;
  const fileName = `backup_${Date.now()}.json`;
  const fileBuffer = Buffer.from(JSON.stringify(backup, null, 2));

  await bot.telegram.sendDocument(ctx.chat!.id, { source: fileBuffer, filename: fileName });
  await ctx.editMessage('✅ Backup enviado.');
}

export async function resetMessages(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await prisma.messageTemplate.deleteMany({});
  await prisma.buttonConfig.deleteMany({});
  await ctx.editMessage('♻️ Mensagens e botões restaurados ao padrão.');
}
