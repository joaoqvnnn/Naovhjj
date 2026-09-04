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
import { routeAdminCallback } from './admin/adminCallbackRouter';
import { showProduct } from './screens/product';

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

// Callbacks de ranking
bot.action('rank_servicos', async (ctx) => { await showRanking(ctx, 'servicos'); });
bot.action('rank_recargas', async (ctx) => { await showRanking(ctx, 'recargas'); });
bot.action('rank_saldo', async (ctx) => { await showRanking(ctx, 'saldo'); });
bot.action('rank_compras', async (ctx) => { await showRanking(ctx, 'compras'); });

// Callback de compra
bot.action(/^comprar_(\d+)$/, async (ctx) => {
  const productId = parseInt(ctx.match[1]);
  await showProduct(ctx, productId);
});

// Outros callbacks dinâmicos
bot.action('menu_recarregar', async (ctx) => { await goToScreen(ctx, 'recarregar'); });
bot.action('voltar_inicio', async (ctx) => { await goToScreen(ctx, 'start'); });

// Todos os callbacks administrativos serão roteados por adminCallbackRouter
bot.action(/.*/, async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  if (callbackData.startsWith('admin_') || callbackData.startsWith('config_') || callbackData.startsWith('aff_') || callbackData.startsWith('pixcfg_') || callbackData.startsWith('logins_') || callbackData.startsWith('research_') || callbackData.startsWith('template_') || callbackData.startsWith('btn') || callbackData.startsWith('bcast_') || callbackData.startsWith('antiflood_') || callbackData.startsWith('notif_') || callbackData.startsWith('saque_') || callbackData.startsWith('pixmanual_') || callbackData.startsWith('admin_updates_')) {
    await routeAdminCallback(ctx, callbackData);
  } else {
    // fallback para outros callbacks não administrativos
    await ctx.answerCbQuery('Ação não reconhecida.');
  }
});

// Mensagens naturais (IA)
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
