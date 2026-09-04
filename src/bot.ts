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
import { startChangeWhatsApp } from './flows/alterarDados';
import { startWhatsAppDelivery } from './flows/delivery';
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
import { showAtendimentoDireto } from './flows/atendimentoDireto';
import { showSupportConfig, editSupportLink, editBotVersion, editStoreName } from './admin/supportConfig';
import { showSobreConfig, editSobreContent } from './admin/sobreConfig';
import { listProducts, createProduct, editProduct, editProductName, editProductPrice, editProductDescription, editProductImage, toggleProduct, deleteProduct, listCategories, createCategory, editCategoryName, deleteCategory } from './admin/productCategoryAdminFull';

const bot = new Telegraf<Context>(config.botToken);

bot.use(sessionMiddleware);
bot.use(blockedUserMiddleware);
bot.use(maintenanceMiddleware);
bot.use(inactivityMiddleware);
bot.use(captureMiddleware);

// ==========================
// COMANDO /start
// ==========================
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
    text = `🎬 Bem-vindo à Larizinha Store!\n\n` +
      `💠 Seus Dados:\n` +
      `├ 👤 ID: ${userId}\n` +
      `└ 💰 Saldo: R$ ${user.balance.toString()}\n\n` +
      `Use os botões abaixo para navegar.`;
  }

  await ctx.replyWithHTML(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🛍️ Comprar Produtos', callback_data: 'menu_comprar' }],
        [{ text: '👤 Meu Perfil', callback_data: 'menu_perfil' }],
        [{ text: '💰 Recarregar', callback_data: 'menu_recarregar' }],
        [{ text: '🤝 Afiliados', callback_data: 'menu_afiliados' }],
        [{ text: '🏆 Ranking', callback_data: 'menu_ranking' }],
        [{ text: 'ℹ️ Sobre', callback_data: 'menu_sobre' }],
      ],
    },
  });
});

// Comando admin
bot.command('admin', async (ctx) => {
  const userId = ctx.from.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
  if (user && user.role !== 'USER') {
    await goToScreen(ctx, 'admin_start');
  } else {
    await ctx.reply('Acesso negado.');
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

// ==========================
// CALLBACKS DO MENU PRINCIPAL
// ==========================
bot.action('menu_comprar', async (ctx) => { await ctx.answerCbQuery(); await goToScreen(ctx, 'comprar'); });
bot.action('menu_perfil', async (ctx) => { await ctx.answerCbQuery(); await goToScreen(ctx, 'perfil'); });
bot.action('menu_recarregar', async (ctx) => { await ctx.answerCbQuery(); await goToScreen(ctx, 'recarregar'); });
bot.action('menu_afiliados', async (ctx) => { await ctx.answerCbQuery(); await goToScreen(ctx, 'afiliados'); });
bot.action('menu_ranking', async (ctx) => { await ctx.answerCbQuery(); await goToScreen(ctx, 'ranking'); });
bot.action('menu_sobre', async (ctx) => {
  await ctx.answerCbQuery();
  const url = `${config.web.url}/web/sobre`;
  await ctx.replyWithHTML(`ℹ️ <a href="${url}">Clique aqui para abrir a página Sobre</a>`, {
    reply_markup: { inline_keyboard: [[{ text: '📄 Abrir página', url }]] },
  });
});

// ==========================
// CALLBACKS DE AÇÕES DO MENU
// ==========================
bot.action('pix_rapido', async (ctx) => {
  const { startCapture } = await import('./middlewares/capture');
  await startCapture(ctx, 'pix_valor', 'Digite o valor para recarregar:', {
    validate: async (input) => {
      const num = parseFloat(input.replace(',', '.'));
      return isNaN(num) || num <= 0 ? 'Valor inválido.' : null;
    },
    onSuccess: async (ctx, value) => {
      const { startPixPayment } = await import('./flows/pixPayment');
      await startPixPayment(ctx, parseFloat(value.replace(',', '.')));
    },
  });
});

bot.action('menu_historico', async (ctx) => {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) }, include: { orders: { include: { product: true } } } });
  if (!user || !user.orders.length) {
    await ctx.editMessageText('📭 Você não tem compras.', {
      reply_markup: { inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'menu_perfil' }]] },
    });
    return;
  }

  let text = '🛍 Histórico de Compras\n\n';
  user.orders.slice(0, 10).forEach((order, i) => {
    text += `${i + 1}. ${order.product.name} - R$ ${order.totalPrice} - ${order.status}\n`;
  });

  await ctx.editMessageText(text, {
    reply_markup: { inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'menu_perfil' }]] },
  });
});

bot.action('menu_giftcard', async (ctx) => {
  const { startCapture } = await import('./middlewares/capture');
  await startCapture(ctx, 'giftcard_code', 'Digite o código do Gift Card:', {
    validate: async (input) => input.trim().length > 0 ? null : 'Código inválido.',
    onSuccess: async (ctx, code) => {
      const { processGiftCardRedemption } = await import('./flows/balanceOperations');
      const result = await processGiftCardRedemption(ctx.from!.id, code.trim().toUpperCase());
      await ctx.editMessageText(result.message);
    },
  });
});

bot.action('menu_alterar_dados', async (ctx) => {
  await ctx.editMessageText('✏️ Alterar Dados\n\nSelecione o dado:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📱 WhatsApp', callback_data: 'alterar_whatsapp' }],
        [{ text: '⏮️ Voltar', callback_data: 'menu_perfil' }],
      ],
    },
  });
});

bot.action('saque_menu', async (ctx) => {
  await ctx.editMessageText('💸 Saque\n\nEscolha o método:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💠 Pix', callback_data: 'saque_pix' }],
        [{ text: '🏦 Transferência bancária', url: `${process.env.WEB_URL}/web/saque` }],
        [{ text: '⏮️ Voltar', callback_data: 'menu_afiliados' }],
      ],
    },
  });
});

bot.action('saque_historico', async (ctx) => {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) }, include: { withdrawals: true } });
  if (!user || !user.withdrawals.length) {
    await ctx.editMessageText('📭 Você ainda não solicitou saques.', {
      reply_markup: { inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'menu_afiliados' }]] },
    });
    return;
  }

  let text = '📊 Histórico de Saques\n\n';
  user.withdrawals.forEach(w => {
    text += `#${w.id} - R$ ${w.amount} - ${w.status} - ${w.createdAt.toLocaleDateString('pt-BR')}\n`;
  });

  await ctx.editMessageText(text, {
    reply_markup: { inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'menu_afiliados' }]] },
  });
});

// ==========================
// CALLBACKS DE RANKING
// ==========================
bot.action('rank_servicos', async (ctx) => { await showRanking(ctx, 'servicos'); });
bot.action('rank_recargas', async (ctx) => { await showRanking(ctx, 'recargas'); });
bot.action('rank_saldo', async (ctx) => { await showRanking(ctx, 'saldo'); });
bot.action('rank_compras', async (ctx) => { await showRanking(ctx, 'compras'); });

// ==========================
// CALLBACKS ADMIN (resumido)
// ==========================
bot.action('admin_dashboard', async (ctx) => { await ctx.answerCbQuery(); await goToScreen(ctx, 'admin_dashboard'); });
bot.action('admin_menu_config', async (ctx) => { await ctx.answerCbQuery(); await goToScreen(ctx, 'admin_menu_config'); });
bot.action('admin_menu_actions', async (ctx) => { await ctx.answerCbQuery(); await goToScreen(ctx, 'admin_menu_actions'); });
bot.action('admin_menu_transactions', async (ctx) => { await ctx.answerCbQuery(); await goToScreen(ctx, 'admin_menu_transactions'); });
bot.action('admin_menu_updates', async (ctx) => { await ctx.answerCbQuery(); await goToScreen(ctx, 'admin_menu_updates'); });

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
    await ctx.answerCbQuery('Ação não reconhecida.');
  }
});

// ==========================
// CAPTURA DE MENSAGENS
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

bot.catch((err, ctx) => {
  console.error(`Erro para ${ctx.from?.id}:`, err);
  ctx.reply('Ocorreu um erro. Tente novamente.');
});

export default bot;
