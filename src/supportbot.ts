import { Telegraf, Context } from 'telegraf';
import prisma from './database';
import { generateAIResponse } from './services/openai';
import { logAction } from './services/logger';

const supportBotToken = process.env.SUPPORT_BOT_TOKEN || process.env.BOT_TOKEN;
const supportBot = new Telegraf<Context>(supportBotToken);

supportBot.start(async (ctx) => {
  await ctx.reply('👤 Atendimento Larizinha Store\n\nEnvie sua mensagem e nossa equipe (ou IA) responderá em instantes.');
});

supportBot.on('text', async (ctx) => {
  const messageText = ctx.message.text;
  const userId = ctx.from.id;

  try {
    // Busca o usuário no banco da loja pelo Telegram ID
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(userId) },
      include: {
        orders: { orderBy: { createdAt: 'desc' }, take: 5 },
        withdrawals: { orderBy: { createdAt: 'desc' }, take: 3 },
      },
    });

    if (!user) {
      await ctx.reply('Você ainda não está cadastrado no bot da loja. Use /start no @larizinhastorebot primeiro.');
      return;
    }

    // Mostra indicador de digitação
    await ctx.replyWithChatAction('typing');

    // Gera resposta da IA com base nos dados do usuário
    const response = await generateAIResponse(user.id, messageText);

    // Envia resposta
    await ctx.reply(response, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '👤 Falar com humano', callback_data: 'support_human' }],
        ],
      },
    });

    // Registra log
    await logAction({
      action: 'SUPPORT_BOT_MESSAGE',
      userId: user.id,
      details: { message: messageText, response },
    });
  } catch (error) {
    console.error('Erro no bot de suporte:', error);
    await ctx.reply('⚠️ Erro ao processar sua mensagem. Tente novamente.');
  }
});

supportBot.action('support_human', async (ctx) => {
  await ctx.answerCbQuery();
  const humanLink = process.env.SUPPORT_CHAT_LINK || 'https://t.me/larizinhastorebot';
  await ctx.reply(`Para falar com um atendente humano, acesse: ${humanLink}`);
});

supportBot.catch((err, ctx) => {
  console.error('Erro no supportBot:', err);
  ctx.reply('Erro inesperado.');
});

export default supportBot;
