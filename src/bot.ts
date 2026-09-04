import { Telegraf, Context } from 'telegraf';
import config from './config';
import prisma from './database';
import { sessionMiddleware } from './middlewares/session';
import { captureMiddleware } from './middlewares/capture';
import { blockedUserMiddleware } from './middlewares/blockedUser';
import { maintenanceMiddleware } from './middlewares/maintenance';
import { cmdPix, cmdHistorico, cmdAlerta, cmdTermos, cmdRanking, cmdSaldo, cmdId, cmdAfiliados } from './commands';
import { handleNaturalLanguage } from './flows/aiAssistant';
import { handleDynamicButton } from './flows/buttonHandlers';
import { handleInlineQuery } from './flows/inlineSearch';
import { goToScreen } from './screens/manager';
import { showRanking } from './flows/ranking';

const bot = new Telegraf<Context>(config.botToken);

bot.use(sessionMiddleware);
bot.use(blockedUserMiddleware);
bot.use(maintenanceMiddleware);
bot.use(captureMiddleware);

// Comandos
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  let user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
  if (!user) {
    user = await prisma.user.create({ data: { telegramId: BigInt(userId), username: ctx.from.username } });
    const { applyRegisterBonus } = await import('./services/bonus');
    await applyRegisterBonus(user.id);
  }
  await goToScreen(ctx, 'start');
});

bot.command('pix', cmdPix);
bot.command('historico', cmdHistorico);
bot.command('alerta', cmdAlerta);
bot.command('termos', cmdTermos);
bot.command('ranking', cmdRanking);
bot.command('saldo', cmdSaldo);
bot.command('id', cmdId);
bot.command('afiliados', cmdAfiliados);

// Inline query
bot.on('inline_query', handleInlineQuery);

// Callback do botão Atendimento -> agora envia link para chat privado
bot.action('menu_suporte', async (ctx) => {
  await ctx.answerCbQuery();
  const supportLink = process.env.SUPPORT_CHAT_LINK || 'https://t.me/larizinhastorebot';
  await ctx.reply(`👤 Atendimento\n\nClique no link abaixo para falar com nossa equipe no chat privado:\n${supportLink}`, {
    reply_markup: {
      inline_keyboard: [[{ text: '💬 Abrir atendimento', url: supportLink }]],
    },
  });
});

// Callbacks de ranking
bot.action('rank_servicos', async (ctx) => { await showRanking(ctx, 'servicos'); });
bot.action('rank_recargas', async (ctx) => { await showRanking(ctx, 'recargas'); });
bot.action('rank_saldo', async (ctx) => { await showRanking(ctx, 'saldo'); });
bot.action('rank_compras', async (ctx) => { await showRanking(ctx, 'compras'); });

// Callback de compra
bot.action(/^comprar_(\d+)$/, async (ctx) => {
  const productId = parseInt(ctx.match[1]);
  await handleDynamicButton(ctx, 'comprar', String(productId));
});

// Mensagens naturais (IA embutida no bot principal, opcional)
bot.on('text', async (ctx) => {
  if (ctx.message && 'text' in ctx.message) {
    await handleNaturalLanguage(ctx, ctx.message.text);
  }
});

bot.catch((err, ctx) => {
  console.error(`Erro para ${ctx.from?.id}:`, err);
  ctx.reply('Ocorreu um erro. Tente novamente.');
});

export default bot;
