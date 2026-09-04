import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';
import { logger } from '../services/logger';

// Mostra menu de transmissão
export async function showBroadcastMenu(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  await ctx.editMessage(
    `📢 TRANSMISSÃO\n\n` +
    `Escolha o segmento de usuários para enviar a mensagem:`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '👥 Todos', callback_data: 'broadcast_all' }],
          [{ text: '🟢 Ativos', callback_data: 'broadcast_active' }],
          [{ text: '🛒 Compradores', callback_data: 'broadcast_buyers' }],
          [{ text: '🤝 Afiliados', callback_data: 'broadcast_affiliates' }],
          [{ text: '⏮️ Voltar', callback_data: 'admin_dashboard' }],
        ],
      },
    }
  );
}

// Inicia fluxo de broadcast para um segmento
export async function startBroadcast(ctx: Context, segment: string) {
  if (!(await isAdmin(ctx))) return;

  await startCapture(ctx, 'broadcast_text', 'Digite o texto da mensagem a ser enviada (pode usar Markdown):', {
    validate: async (input) => {
      if (input.length < 1) return '❌ Mensagem vazia.';
      if (input.length > 4000) return '❌ Mensagem muito longa (máx. 4000 caracteres).';
      return null;
    },
    onSuccess: async (ctx, text) => {
      // Salva temporariamente na sessão
      ctx.session.data = { ...ctx.session.data, broadcastText: text, segment };

      await ctx.editMessage(`📢 Confirme o envio:\n\nSegmento: ${segment}\n\nMensagem:\n${text}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Enviar agora', callback_data: 'broadcast_send' }],
            [{ text: '❌ Cancelar', callback_data: 'broadcast_cancel' }],
          ],
        },
      });
    },
  });
}

// Envia o broadcast
export async function sendBroadcast(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const text = ctx.session.data?.broadcastText;
  const segment = ctx.session.data?.segment;
  if (!text || !segment) {
    await ctx.editMessage('❌ Dados do broadcast não encontrados.');
    return;
  }

  // Determina a condição de filtro
  let whereClause: any = {};
  switch (segment) {
    case 'all':
      whereClause = {};
      break;
    case 'active':
      whereClause = { status: 'ACTIVE' };
      break;
    case 'buyers':
      whereClause = { orders: { some: {} } };
      break;
    case 'affiliates':
      whereClause = { affiliateBalance: { gt: 0 } };
      break;
  }

  // Busca usuários
  const users = await prisma.user.findMany({
    where: whereClause,
    select: { telegramId: true },
  });

  let sent = 0;
  const bot = (await import('../bot')).default;
  for (const user of users) {
    try {
      await bot.telegram.sendMessage(user.telegramId.toString(), text, {
        parse_mode: 'Markdown',
      });
      sent++;
      // Pequeno delay para evitar flood do Telegram
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      logger.error('Falha ao enviar broadcast', { error, telegramId: user.telegramId });
    }
  }

  await ctx.editMessage(`✅ Broadcast enviado para ${sent} de ${users.length} usuários.`);
  ctx.session.data = {};
}
