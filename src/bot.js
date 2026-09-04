import { Telegraf, Context } from 'telegraf';
import config from './config';
import prisma from './database';

// Cria a instância do bot
const bot = new Telegraf<Context>(config.botToken);

// Middleware para tratar erros globalmente
bot.catch((err, ctx) => {
  console.error(`Erro para o usuário ${ctx.from?.id}:`, err);
  ctx.reply('⚠️ Ocorreu um erro inesperado. Tente novamente mais tarde.').catch(() => {});
});

// Middleware anti-flood básico (pode ser expandido depois)
const userLastAction = new Map<number, number>();
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  if (!userId) return next();

  const now = Date.now();
  const last = userLastAction.get(userId) || 0;
  const diff = now - last;
  if (diff < 500) { // 500ms entre ações
    return; // ignora silenciosamente ou responde
  }
  userLastAction.set(userId, now);
  return next();
});

// Comando /start
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name;

  // Busca ou cria usuário no banco
  let user = await prisma.user.findUnique({
    where: { telegramId: userId },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        telegramId: userId,
        username: username,
      },
    });
  }

  // Mensagem inicial (ainda sem personalização avançada, apenas exemplo)
  const saldo = user.saldo ?? 0;
  await ctx.reply(
    `🎬 Bem-vindo à Larizinha Store! ✨\n` +
    `A sua central de streamings com entrega 100% automática.\n\n` +
    `💠 Seus Dados:\n` +
    `├ 👤 ID: ${userId}\n` +
    `└ 💰 Saldo Atual: R$ ${saldo.toFixed(2)}\n\n` +
    `👇 COMO COMEÇAR:\n` +
    `Clique no botão abaixo…`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛍️ Comprar', callback_data: 'menu_comprar' }],
          [{ text: '👤 Meu Perfil', callback_data: 'menu_perfil' }],
          [{ text: '💰 Recarregar', callback_data: 'menu_recarregar' }],
        ],
      },
    }
  );
});

// Exporta o bot para ser usado no index.ts
export default bot;
