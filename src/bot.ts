import { Telegraf, Context } from 'telegraf';
import config from './config';
import prisma from './database';
import { sessionMiddleware } from './middlewares/session';
import { captureMiddleware } from './middlewares/capture';
import { blockedUserMiddleware } from './middlewares/blockedUser';
import { maintenanceMiddleware } from './middlewares/maintenance';
import { inactivityMiddleware } from './middlewares/inactivity';
import { cmdPix, cmdHistorico, cmdAlerta, cmdTermos, cmdRanking, cmdSaldo, cmdId, cmdAfiliados } from './commands';
import { handleNaturalLanguage } from './flows/aiAssistant';
import { handleInlineQuery } from './flows/inlineSearch';
import { goToScreen } from './screens/manager';
import { showRanking } from './flows/ranking';
import { routeAdminCallback } from './admin/adminCallbackRouter';
import { showProduct } from './screens/product';
import { showAlertsScreen, toggleAlert } from './flows/alerts';
import { startChangeWhatsApp } from './flows/changeData';
import { startWhatsAppDelivery, startEmailDelivery } from './flows/delivery';
import { handleAttendanceButton, handleHumanButton, handleExitSupport } from './handlers/attendance';
import { handleSupportMessage } from './flows/aiSupport';
import { showAffiliatePoints, convertPointsToBalance } from './flows/affiliatePoints';
import { showNotificationTemplateMenu, viewNotificationTemplate, editNotificationTemplate, resetNotificationTemplate } from './admin/notificationTemplates';
import { handleActivateCoupon, handleRedeemCoupon, handleResgatarCommand } from './flows/promotions';
import { showPromotionsMenu, createScheduledPromotion, createCouponPromotion, finalizeScheduledPromotion, listPromotions } from './admin/promotions';
import { showRateLimitConfig, editRateLimitConfig } from './admin/rateLimitConfig';
import { showRentBot } from './flows/rentBot';
import { showUsersMenu, listUsers, searchUser, editUserBalance, toggleUserBlock, sendMessageToUser } from './admin/userManagementFull';
import { generateUserHistoryPdf } from './flows/userHistoryPdf';
import { showSobre } from './flows/sobre';
import { showDirectSupport } from './flows/directSupport';
import { showSupportConfig, editSupportLink, editBotVersion, editStoreName } from './admin/supportConfig';
import { showSobreConfig, editSobreContent } from './admin/sobreConfig';
import { listProducts, createProduct, editProduct, editProductName, editProductPrice, editProductDescription, editProductImage, toggleProduct, deleteProduct, listCategories, createCategory, editCategoryName, deleteCategory } from './admin/productCategoryAdminFull';
import { purchaseProduct } from './flows/purchase';
import { startMultiplePurchase } from './flows/purchaseQuantity';
import { showRechargeMenu, startRechargeCapture } from './flows/recharge';
import { showHistory } from './flows/history';
import { showAfiliadosMenu } from './flows/afiliados';

const bot = new Telegraf<Context>(config.botToken);

bot.use(sessionMiddleware);
bot.use(blockedUserMiddleware);
bot.use(maintenanceMiddleware);
bot.use(inactivityMiddleware);
bot.use(captureMiddleware);

bot.start(async (ctx) => {
  const userId = ctx.from.id;
  let user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
  if (!user) {
    user = await prisma.user.create({ data: { telegramId: BigInt(userId), username: ctx.from.username } });
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { lastActivityAt: new Date() } });
  }

  const template = await prisma.messageTemplate.findUnique({ where: { key: 'start' } });
  let text = '';
  if (template) {
    text = template.text
      .replace(/\{telegram_id\}/g, String(userId))
      .replace(/\{saldo\}/g, user.balance.toString());
  } else {
    text = `🎬 Welcome to Larizinha Store!\n\n` +
      `💠 Your Data:\n` +
      `├ 👤 ID: ${userId}\n` +
      `└ 💰 Balance: R$ ${user.balance.toString()}\n\n` +
      `Use the buttons below.`;
  }

  await ctx.replyWithHTML(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🛍️ Buy Products', callback_data: 'menu_buy' }],
        [{ text: '👤 My Profile', callback_data: 'menu_profile' }],
        [{ text: '💰 Recharge', callback_data: 'menu_recharge' }],
        [{ text: '🤝 Affiliates', callback_data: 'menu_affiliates' }],
        [{ text: '🏆 Ranking', callback_data: 'menu_ranking' }],
        [{ text: 'ℹ️ About', callback_data: 'menu_about' }],
      ],
    },
  });
});

bot.command('admin', async (ctx) => {
  const userId = ctx.from.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
  if (user && user.role !== 'USER') {
    await goToScreen(ctx, 'admin_start');
  } else {
    await ctx.reply('Access denied.');
  }
});

bot.command('pix', cmdPix);
bot.command('historico', cmdHistorico);
bot.command('alerta', cmdAlerta);
bot.command('termos', cmdTermos);
bot.command('ranking', cmdRanking);
bot.command('saldo', cmdSaldo);
bot.command('id', cmdId);
bot.command('afiliados', cmdAfiliados);
bot.command('resgatar', handleResgatarCommand);

bot.on('inline_query', handleInlineQuery);

// Menu callbacks
bot.action('menu_buy', async (ctx) => { await ctx.answerCbQuery(); await goToScreen(ctx, 'comprar'); });
bot.action('menu_profile', async (ctx) => { await ctx.answerCbQuery(); await goToScreen(ctx, 'perfil'); });
bot.action('menu_recharge', async (ctx) => { await ctx.answerCbQuery(); await goToScreen(ctx, 'recarregar'); });
bot.action('menu_affiliates', async (ctx) => { await ctx.answerCbQuery(); await goToScreen(ctx, 'afiliados'); });
bot.action('menu_ranking', async (ctx) => { await ctx.answerCbQuery(); await goToScreen(ctx, 'ranking'); });
bot.action('menu_about', async (ctx) => { await ctx.answerCbQuery(); await showSobre(ctx); });

// Purchase
bot.action(/^view_product_(\d+)$/, async (ctx) => { const id = parseInt(ctx.match[1]); await showProduct(ctx, id); });
bot.action(/^buy_(\d+)$/, async (ctx) => { const id = parseInt(ctx.match[1]); await purchaseProduct(ctx, id); });
bot.action(/^buy_qty_(\d+)$/, async (ctx) => { const id = parseInt(ctx.match[1]); await startMultiplePurchase(ctx, id); });

// Delivery
bot.action(/^deliver_whatsapp_(\d+)$/, async (ctx) => { const id = parseInt(ctx.match[1]); await startWhatsAppDelivery(ctx, id); });
bot.action(/^deliver_email_(\d+)$/, async (ctx) => { const id = parseInt(ctx.match[1]); await startEmailDelivery(ctx, id); });

// Recharge
bot.action('pix_quick', async (ctx) => { await startRechargeCapture(ctx); });

// History
bot.action('menu_history', async (ctx) => { await showHistory(ctx); });
bot.action(/^hist_page_(\d+)$/, async (ctx) => { const page = parseInt(ctx.match[1]); await showHistory(ctx, page); });

// Change data
bot.action('change_whatsapp', async (ctx) => { await startChangeWhatsApp(ctx); });

// Direct support
bot.action('menu_direct_support', async (ctx) => { await showDirectSupport(ctx); });

// Rankings
bot.action('rank_servicos', async (ctx) => { await showRanking(ctx, 'servicos'); });
bot.action('rank_recargas', async (ctx) => { await showRanking(ctx, 'recargas'); });
bot.action('rank_saldo', async (ctx) => { await showRanking(ctx, 'saldo'); });
bot.action('rank_compras', async (ctx) => { await showRanking(ctx, 'compras'); });

// Alerts
bot.action(/^alert_toggle_(\d+)$/, async (ctx) => { const id = parseInt(ctx.match[1]); await toggleAlert(ctx, id); });
bot.action(/^alerts_page_(\d+)$/, async (ctx) => { const page = parseInt(ctx.match[1]); await showAlertsScreen(ctx, page); });

// Admin
bot.action('admin_dashboard', async (ctx) => { await ctx.answerCbQuery(); await goToScreen(ctx, 'admin_dashboard'); });
bot.action('admin_menu_config', async (ctx) => { await ctx.answerCbQuery(); await goToScreen(ctx, 'admin_menu_config'); });
bot.action('admin_menu_actions', async (ctx) => { await ctx.answerCbQuery(); await goToScreen(ctx, 'admin_menu_actions'); });
bot.action('admin_menu_transactions', async (ctx) => { await ctx.answerCbQuery(); await goToScreen(ctx, 'admin_menu_transactions'); });
bot.action('admin_menu_updates', async (ctx) => { await ctx.answerCbQuery(); await goToScreen(ctx, 'admin_menu_updates'); });

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
    callbackData.startsWith('wa_af_') ||
    callbackData.startsWith('promo_') ||
    callbackData.startsWith('ratelimit_') ||
    callbackData.startsWith('giftcard_admin_') ||
    callbackData.startsWith('security_') ||
    callbackData.startsWith('user_') ||
    callbackData.startsWith('users_') ||
    callbackData.startsWith('support_') ||
    callbackData.startsWith('sobre_') ||
    callbackData.startsWith('prod_') ||
    callbackData.startsWith('cat_') ||
    callbackData === 'admin_config_users'
  ) {
    await routeAdminCallback(ctx, callbackData);
  } else {
    await ctx.answerCbQuery('Action not recognized.');
  }
});

bot.on('text', async (ctx) => {
  if (ctx.session.data?.supportMode && ctx.message && 'text' in ctx.message) {
    await handleSupportMessage(ctx, ctx.message.text);
    return;
  }
  if (ctx.message && 'text' in ctx.message) {
    await handleNaturalLanguage(ctx, ctx.message.text);
  }
});

bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.from?.id}:`, err);
  ctx.reply('An error occurred. Try again.');
});

export default bot;
