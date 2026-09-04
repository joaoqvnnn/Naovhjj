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
import { showAlertsScreen, toggleAlert } from './flows/alerts';
import { startChangeWhatsApp } from './flows/alterarDados';
import { startWhatsAppDelivery } from './flows/delivery';
import { handleAttendanceButton, handleHumanButton, handleExitSupport } from './handlers/attendance';
import { handleSupportMessage } from './flows/aiSupport';
import { showAffiliatePoints, convertPointsToBalance } from './flows/affiliatePoints';
import { showNotificationTemplateMenu, viewNotificationTemplate, editNotificationTemplate, resetNotificationTemplate } from './admin/notificationTemplates';

const bot = new Telegraf<Context>(config.botToken);

// ==========================
// MIDDLEWARES GLOBAIS
// ==========================
bot.use(sessionMiddleware);
bot.use(blockedUserMiddleware);
bot.use(maintenanceMiddleware);
bot.use(captureMiddleware);

// ==========================
// COMANDOS
// ==========================
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

// ==========================
// INLINE QUERY (pesquisa)
// ==========================
bot.on('inline_query', handleInlineQuery);

// ==========================
// CALLBACKS DE ATENDIMENTO
// ==========================
bot.action('menu_suporte', handleAttendanceButton);
bot.action('support_human', handleHumanButton);
bot.action('support_exit', handleExitSupport);

// ==========================
// CALLBACKS DE RANKING
// ==========================
bot.action('rank_servicos', async (ctx) => { await showRanking(ctx, 'servicos'); });
bot.action('rank_recargas', async (ctx) => { await showRanking(ctx, 'recargas'); });
bot.action('rank_saldo', async (ctx) => { await showRanking(ctx, 'saldo'); });
bot.action('rank_compras', async (ctx) => { await showRanking(ctx, 'compras'); });

// ==========================
// CALLBACKS DE COMPRA
// ==========================
bot.action(/^comprar_(\d+)$/, async (ctx) => {
  const productId = parseInt(ctx.match[1]);
  await showProduct(ctx, productId);
});

// ==========================
// CALLBACKS DE ALERTAS
// ==========================
bot.action(/^alert_toggle_(\d+)$/, async (ctx) => {
  const productId = parseInt(ctx.match[1]);
  await toggleAlert(ctx, productId);
});

bot.action(/^alerts_page_(\d+)$/, async (ctx) => {
  const page = parseInt(ctx.match[1]);
  ctx.session.data = { ...ctx.session.data, alertPage: page };
  await showAlertsScreen(ctx, page);
});

// ==========================
// CALLBACKS DE ALTERAÇÃO DE DADOS
// ==========================
bot.action('alterar_whatsapp', async (ctx) => {
  await ctx.answerCbQuery();
  await startChangeWhatsApp(ctx);
});

// ==========================
// CALLBACKS DE ENTREGA POR WHATSAPP
// ==========================
bot.action(/^entregar_whatsapp_(\d+)$/, async (ctx) => {
  const orderId = parseInt(ctx.match[1]);
  await startWhatsAppDelivery(ctx, orderId);
});

// ==========================
// CALLBACKS DE PONTOS DE AFILIADO
// ==========================
bot.action('menu_pontos', async (ctx) => {
  await ctx.answerCbQuery();
  await showAffiliatePoints(ctx);
});

bot.action('aff_convert_points', async (ctx) => {
  await ctx.answerCbQuery();
  await convertPointsToBalance(ctx);
});

// ==========================
// CALLBACKS DE NOTIFICAÇÕES ADMIN
// ==========================
bot.action('admin_actions_notifications', async (ctx) => {
  await ctx.answerCbQuery();
  await showNotificationTemplateMenu(ctx);
});

bot.action(/^notiftpl_(.+)$/, async (ctx) => {
  const eventKey = ctx.match[1];
  await ctx.answerCbQuery();
  await viewNotificationTemplate(ctx, eventKey);
});

bot.action(/^notiftpledit_(.+)$/, async (ctx) => {
  const eventKey = ctx.match[1];
  await ctx.answerCbQuery();
  await editNotificationTemplate(ctx, eventKey);
});

bot.action(/^notiftplreset_(.+)$/, async (ctx) => {
  const eventKey = ctx.match[1];
  await ctx.answerCbQuery();
  await resetNotificationTemplate(ctx, eventKey);
});

// ==========================
// CALLBACKS DINÂMICOS GERAIS
// ==========================
bot.action('menu_recarregar', async (ctx) => { await goToScreen(ctx, 'recarregar'); });
bot.action('voltar_inicio', async (ctx) => { await goToScreen(ctx, 'start'); });

// ==========================
// ROTEAMENTO ADMIN
// ==========================
bot.action(/.*/, async (ctx) => {
  const callbackData = ctx.callbackQuery.data;
  if (
    callbackData.startsWith('admin_') ||
    callbackData.startsWith('config_') ||
    callbackData.startsWith('aff_') ||
    callbackData.startsWith('pixcfg_') ||
    callbackData.startsWith('logins_') ||
    callbackData.startsWith('research_') ||
    callbackData.startsWith('template_') ||
    callbackData.startsWith('btn') ||
    callbackData.startsWith('bcast_') ||
    callbackData.startsWith('antiflood_') ||
    callbackData.startsWith('notif_') ||
    callbackData.startsWith('saque_') ||
    callbackData.startsWith('pixmanual_') ||
    callbackData.startsWith('admin_updates_') ||
    callbackData.startsWith('wa_af_') // anti-flood WhatsApp
  ) {
    await routeAdminCallback(ctx, callbackData);
  } else {
    await ctx.answerCbQuery('Ação não reconhecida.');
  }
});

// ==========================
// MENSAGENS DE TEXTO
// ==========================
bot.on('text', async (ctx) => {
  if (ctx.session.data?.supportMode && ctx.message && 'text' in ctx.message) {
    await handleSupportMessage(ctx, ctx.message.text);
    return;
  }
  if (ctx.message && 'text' in ctx.message) {
    await handleNaturalLanguage(ctx, ctx.message.text);
  }
});

// ==========================
// TRATAMENTO DE ERROS
// ==========================
bot.catch((err, ctx) => {
  console.error(`Erro para ${ctx.from?.id}:`, err);
  ctx.reply('Ocorreu um erro. Tente novamente.');
});

export default bot;
