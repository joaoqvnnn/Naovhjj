import { Context } from '../types/context';
import prisma from '../database';
import { generateAIResponse } from '../services/openai';
import { logAction } from '../services/logger';

// Inicia o modo de atendimento com IA
export async function startAISupport(ctx: Context) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });

  if (!user) {
    await ctx.editMessage('Usuário não encontrado.');
    return;
  }

  // Ativa o modo IA na sessão
  ctx.session.data = { ...ctx.session.data, supportMode: true };

  await ctx.editMessage(
    `🤖 Atendimento Virtual\n\n` +
    `Olá! Eu sou o assistente virtual da Larizinha Store.\n` +
    `Pode me perguntar sobre seu saldo, compras, afiliados, etc.\n\n` +
    `Digite sua pergunta ou use os botões abaixo:`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '👤 Falar com humano', callback_data: 'support_human' }],
          [{ text: '❌ Encerrar atendimento', callback_data: 'support_exit' }],
        ],
      },
    }
  );
}

// Processa mensagens quando o modo IA está ativo
export async function handleSupportMessage(ctx: Context, text: string) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });

  if (!user || !ctx.session.data?.supportMode) return;

  await ctx.replyWithChatAction('typing');
  const response = await generateAIResponse(user.id, text);

  await ctx.reply(response, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '👤 Falar com humano', callback_data: 'support_human' }],
        [{ text: '❌ Encerrar atendimento', callback_data: 'support_exit' }],
      ],
    },
  });

  await logAction({
    action: 'AI_SUPPORT_MESSAGE',
    userId: user.id,
    details: { message: text, response },
  });
}

// Transfere para humano (notifica o dono e fornece link)
export async function transferToHuman(ctx: Context) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });

  if (!user) return;

  // Sai do modo IA
  ctx.session.data = { ...ctx.session.data, supportMode: false };

  // Busca link de suporte configurado
  const supportLink = await prisma.setting.findUnique({ where: { key: 'support_link' } });
  const link = supportLink?.value || 'https://t.me/larizinhastorebot';

  // Envia notificação para o dono (opcional)
  const ownerId = process.env.OWNER_TELEGRAM_ID;
  if (ownerId) {
    const bot = (await import('../bot')).default;
    await bot.telegram.sendMessage(ownerId, `👤 Cliente ${user.username || user.id} solicitou atendimento humano.`);
  }

  await ctx.editMessage(
    `👤 Atendimento Humano\n\n` +
    `Para falar com um atendente, clique no link abaixo:\n` +
    `${link}\n\n` +
    `Obrigado!`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔗 Abrir suporte', url: link }],
          [{ text: '⏮️ Voltar ao menu', callback_data: 'voltar_inicio' }],
        ],
      },
    }
  );

  await logAction({ action: 'SUPPORT_TRANSFERRED_TO_HUMAN', userId: user.id });
}

// Encerra o atendimento IA
export async function exitSupport(ctx: Context) {
  ctx.session.data = { ...ctx.session.data, supportMode: false };
  await ctx.editMessage('Atendimento encerrado. Se precisar, estou aqui!', {
    reply_markup: {
      inline_keyboard: [[{ text: '⏮️ Voltar ao menu', callback_data: 'voltar_inicio' }]],
    },
  });
}
