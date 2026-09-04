import { Telegraf, Context } from 'telegraf';
import config from './config';
import prisma from './database';
import { sessionMiddleware } from './middlewares/session';
import { captureMiddleware } from './middlewares/capture';
import { blockedUserMiddleware } from './middlewares/blockedUser';
import { maintenanceMiddleware } from './middlewares/maintenance';
import { cmdPix, cmdHistorico, cmdAlerta, cmdTermos, cmdRanking, cmdSaldo, cmdId, cmdAfiliados } from './commands';
import { handleNaturalLanguage } from './flows/aiAssistant';
import { goToScreen } from './screens/manager';

const bot = new Telegraf<Context>(config.botToken);

// Middlewares globais
bot.use(sessionMiddleware);
bot.use(blockedUserMiddleware);
bot.use(maintenanceMiddleware);
bot.use(captureMiddleware);

// Comandos
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  let user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
  if (!user) {
    user = await prisma.user.create({
      data: { telegramId: BigInt(userId), username: ctx.from.username },
    });
    // Aplicar bônus de registro
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

// Mensagens naturais (IA)
bot.on('text', async (ctx) => {
  if (ctx.message && 'text' in ctx.message) {
    await handleNaturalLanguage(ctx, ctx.message.text);
  }
});

// Callbacks serão registrados em cada módulo (via import dinâmico)

bot.catch((err, ctx) => {
  console.error(`Erro para ${ctx.from?.id}:`, err);
  ctx.reply('Ocorreu um erro. Tente novamente.');
});

export default bot;
