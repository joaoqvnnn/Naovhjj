import { Context } from '../types/context';
import prisma from '../database';
import { formatCurrency } from '../utils/format';
import { generatePixPayment, getPixConfig, checkPixPaymentStatus, confirmManualPix } from '../services/pixService';
import { logAction } from '../services/logger';

export async function startPixPayment(ctx: Context, amount: number) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
  if (!user) return ctx.editMessage('Usuário não encontrado.');

  const pixConfig = await getPixConfig();
  if (amount < pixConfig.minAmount) return ctx.editMessage(`❌ Valor mínimo: ${formatCurrency(pixConfig.minAmount)}`);
  if (amount > pixConfig.maxAmount) return ctx.editMessage(`❌ Valor máximo: ${formatCurrency(pixConfig.maxAmount)}`);

  try {
    const paymentData = await generatePixPayment(amount, user.id, 'Recarga de saldo');

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

    // Busca template personalizado de Pix (se existir)
    const template = await prisma.messageTemplate.findUnique({ where: { key: 'pix' } });
    let text: string;

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

    // Imagem padrão do template, se houver
    const templateImage = template?.imageUrl;

    if (pixConfig.showQrCode && (paymentData.qrCodeImage || templateImage)) {
      // Usa a imagem do QR Code gerado ou a imagem do template
      const imageToSend = paymentData.qrCodeImage || templateImage;
      await ctx.replyWithPhoto(imageToSend, {
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
