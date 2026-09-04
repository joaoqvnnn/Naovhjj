import { Context } from '../types/context';
import prisma from '../database';
import { startCapture } from '../middlewares/capture';
import { formatCurrency } from '../utils/format';
import { generatePixPayment, getPixConfig, checkPixPaymentStatus, confirmManualPix } from '../services/pixService';
import { logAction } from '../services/logger';

// Inicia pagamento Pix (recarga)
export async function startPixPayment(ctx: Context, amount: number) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
  if (!user) return ctx.editMessage('Usuário não encontrado.');

  // Verifica limites
  const pixConfig = await getPixConfig();
  if (amount < pixConfig.minAmount) return ctx.editMessage(`❌ Valor mínimo: ${formatCurrency(pixConfig.minAmount)}`);
  if (amount > pixConfig.maxAmount) return ctx.editMessage(`❌ Valor máximo: ${formatCurrency(pixConfig.maxAmount)}`);

  try {
    // Gera pagamento
    const paymentData = await generatePixPayment(amount, user.id, 'Recarga de saldo');

    // Salva Payment no banco
    const dbPayment = await prisma.payment.create({
      data: {
        userId: user.id,
        method: 'PIX',
        status: 'PENDING',
        amount,
        externalId: paymentData.externalId ? String(paymentData.externalId) : null,
        qrCode: paymentData.qrCode,
        qrCodeImage: paymentData.qrCodeImage,
        expiresAt: paymentData.expiresAt,
      },
    });

    // Monta mensagem personalizada
    const template = await prisma.messageTemplate.findUnique({ where: { key: 'pix' } });
    let text = '';
    if (template) {
      text = template.text
        .replace(/\{valor\}/g, formatCurrency(amount))
        .replace(/\{pix\}/g, paymentData.qrCode)
        .replace(/\{id\}/g, String(dbPayment.id))
        .replace(/\{expiracao\}/g, `${pixConfig.expirationMinutes} minutos`);
    } else {
      text = `💰 Comprar Saldo com Pix\n\n` +
        `💵 Valor: ${formatCurrency(amount)}\n` +
        `⏱️ Expira em: ${pixConfig.expirationMinutes} min\n` +
        `✨ ID: ${dbPayment.id}\n\n` +
        (paymentData.mode === 'automatico' ? `💎 Pix Copia e Cola:\n<code>${paymentData.qrCode}</code>\n\n` : `💎 Chave Pix manual:\n<code>${paymentData.qrCode}</code>\n\n`);
    }

    // Prepara botões
    const inlineKeyboard = [];
    if (pixConfig.showCopyButton && paymentData.qrCode) {
      inlineKeyboard.push([{ text: '📋 Copiar código Pix', callback_data: `pix_copy_${dbPayment.id}` }]);
    }
    if (paymentData.mode === 'automatico') {
      inlineKeyboard.push([{ text: '🔄 Já paguei', callback_data: `pix_check_${dbPayment.id}` }]);
    } else {
      inlineKeyboard.push([{ text: '📢 Avisei pagamento', callback_data: `pix_manual_notify_${dbPayment.id}` }]);
    }
    inlineKeyboard.push([{ text: '⏮️ Voltar', callback_data: 'voltar_inicio' }]);

    // Envia mensagem com QR Code como imagem (se disponível)
    if (pixConfig.showQrCode && paymentData.qrCodeImage) {
      // Envia foto com legenda
      await ctx.replyWithPhoto(paymentData.qrCodeImage, {
        caption: text,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: inlineKeyboard },
      });
    } else {
      await ctx.editMessage(text, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: inlineKeyboard },
      });
    }
  } catch (error: any) {
    await ctx.editMessage(`❌ ${error.message}`);
  }
}

// Copiar código Pix (exibe código em mensagem separada)
export async function copyPixCode(ctx: Context, paymentId: number) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || !payment.qrCode) return ctx.answerCbQuery('Código não encontrado');
  // Envia o código para copiar
  await ctx.reply(`<code>${payment.qrCode}</code>`, { parse_mode: 'HTML' });
  await ctx.answerCbQuery('Código copiado!');
}

// Verifica pagamento automático
export async function checkPixPayment(ctx: Context, paymentId: number) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== 'PENDING') return;

  try {
    const status = await checkPixPaymentStatus(payment.externalId!);
    if (status === 'APPROVED') {
      // Processa crédito
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({ where: { id: payment.id }, data: { status: 'APPROVED', paidAt: new Date() } });
        await tx.user.update({ where: { id: payment.userId }, data: { balance: { increment: payment.amount } } });
        await tx.recharge.create({
          data: { userId: payment.userId, amount: payment.amount, paymentId: payment.id, status: 'APPROVED' },
        });
      });
      await ctx.editMessage('✅ Pagamento aprovado! Saldo creditado.');
    } else if (status === 'CANCELLED' || status === 'EXPIRED') {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'EXPIRED' } });
      await ctx.editMessage('⌛️ Pagamento expirado ou cancelado.');
    } else {
      await ctx.editMessage('⏳ Ainda pendente. Aguarde a confirmação.');
    }
  } catch (error) {
    console.error(error);
    await ctx.editMessage('❌ Erro ao verificar pagamento.');
  }
}

// Modo manual: usuário avisa que pagou; admin confirma depois
export async function notifyManualPix(ctx: Context, paymentId: number) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.status !== 'PENDING') return;
  await ctx.editMessage('📢 Obrigado! Sua solicitação de pagamento manual foi registrada. Aguarde a confirmação do administrador.');
  await logAction({ action: 'MANUAL_PIX_NOTIFIED', userId: payment.userId, details: { paymentId } });
}
