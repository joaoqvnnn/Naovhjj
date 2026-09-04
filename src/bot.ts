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

// Inline query para pesquisa
bot.on('inline_query', handleInlineQuery);

// Callbacks de botões dinâmicos (ex: comprar, saldo, cadastrar)
bot.action(/^comprar_(\d+)$/, async (ctx) => {
  const productId = parseInt(ctx.match[1]);
  await handleDynamicButton(ctx, 'comprar', String(productId));
});

bot.action('menu_recarregar', async (ctx) => {
  await handleDynamicButton(ctx, 'adicionar_saldo');
});

bot.action('start', async (ctx) => {
  await handleDynamicButton(ctx, 'cadastrar');
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
