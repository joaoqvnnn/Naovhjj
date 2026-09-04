import { Telegraf, Context } from 'telegraf';
import config from './config';
import prisma from './database';
import { sessionMiddleware } from './middlewares/session';
import { captureMiddleware } from './middlewares/capture';
import { blockedUserMiddleware } from './middlewares/blockedUser';
import { maintenanceMiddleware } from './middlewares/maintenance';
import { inactivityMiddleware } from './middlewares/inactivity'; // novo
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
import { handleActivateCoupon, handleRedeemCoupon, handleResgatarCommand } from './flows/promotions';
import { showPromotionsMenu, createScheduledPromotion, createCouponPromotion, finalizeScheduledPromotion, listPromotions } from './admin/promotions';
import { showRateLimitConfig, editRateLimitConfig } from './admin/rateLimitConfig';
import { transcribeAudio } from './services/transcription'; // novo

const bot = new Telegraf<Context>(config.botToken);

// Middlewares
bot.use(sessionMiddleware);
bot.use(blockedUserMiddleware);
bot.use(maintenanceMiddleware);
bot.use(inactivityMiddleware); // novo
bot.use(captureMiddleware);

// Comandos
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  let user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
  if (!user) {
    user = await prisma.user.create({ data: { telegramId: BigInt(userId), username: ctx.from.username } });
    const { applyRegisterBonus } = await import('./services/bonus');
    await applyRegisterBonus(user.id);
  } else {
    // Atualiza última atividade
    await prisma.user.update({ where: { id: user.id }, data: { lastActivityAt: new Date() } });
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
bot.command('resgatar', handleResgatarCommand);

// Inline query
bot.on('inline_query', handleInlineQuery);

// Callbacks (todos os anteriores + admin)
// ... (manter todos os callbacks já existentes)

// Novo handler para mensagens de voz/áudio
bot.on(['voice', 'audio'], async (ctx) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  // Verifica se transcrição está habilitada
  const transcriptionSetting = await prisma.setting.findUnique({ where: { key: 'transcription_enabled' } });
  if (!transcriptionSetting || !transcriptionSetting.value) {
    await ctx.reply('Transcrição de áudio desativada.');
    return;
  }

  const fileId = ctx.message.voice?.file_id || ctx.message.audio?.file_id;
  if (!fileId) return;

  try {
    // Baixa o arquivo de áudio
    const fileUrl = await ctx.telegram.getFileLink(fileId);
    const response = await fetch(fileUrl.href);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Transcreve
    const text = await transcribeAudio(buffer, 'audio/ogg');
    if (!text) {
      await ctx.reply('Não foi possível transcrever o áudio.');
      return;
    }

    // Processa o texto transcrito como mensagem normal
    if (ctx.session.data?.supportMode) {
      await handleSupportMessage(ctx, text);
    } else {
      await handleNaturalLanguage(ctx, text);
    }
  } catch (error) {
    console.error('Erro no processamento de áudio:', error);
    await ctx.reply('Erro ao processar áudio.');
  }
});

// Mensagens de texto normais
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
