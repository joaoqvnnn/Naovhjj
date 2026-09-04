import { Context } from '../types/context';
import prisma from '../database';
import { formatCurrency, formatDate } from '../utils/format';
import { goToScreen } from '../screens/manager';
import { startCapture } from '../middlewares/capture';
import { reserveStock, releaseReservation, confirmSale, getAvailableStock } from '../services/stock';
import { generatePixPayment, getPixConfig, checkPixPaymentStatus, confirmManualPix } from '../services/pixService';
import { creditAffiliateCommission } from './affiliateCommission';
import { applyRechargeBonus } from '../services/bonus';
import { triggerPaymentApproved, triggerSaleCompleted } from '../admin/notificationsTrigger';
import { actionRateLimit } from '../middlewares/actionRateLimit';
import { logAction } from '../services/logger';

// Mostra tela de produto (mantida)
export async function showProduct(ctx: Context, productId: number) {
  // ... (código anterior permanece)
}

// Inicia compra com quantidade 1
export async function buyProduct(ctx: Context, productId: number) {
  await processPurchase(ctx, productId, 1);
}

// Inicia captura de quantidade para compra múltipla
export async function buyProductQuantity(ctx: Context, productId: number) {
  // ... (código anterior permanece)
}

// Processa a compra (agora com suporte a Pix e reserva)
async function processPurchase(ctx: Context, productId: number, quantity: number) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
  if (!user) return ctx.editMessage('Usuário não encontrado.');

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return ctx.editMessage('Produto não encontrado.');

  const total = parseFloat(product.price.toString()) * quantity;
  const balance = parseFloat(user.balance.toString());

  if (balance >= total) {
    // Saldo suficiente: tenta reservar e debitar
    try {
      const unitIds = await reserveStock(productId, quantity, user.id);
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { balance: { decrement: total } },
        });
        const order = await tx.order.create({
          data: {
            userId: user.id,
            productId,
            quantity,
            unitPrice: product.price,
            totalPrice: total,
            status: 'PAID',
            deliveryMethod: 'TELEGRAM',
          },
        });
        await confirmSale(unitIds, order.id);
      });

      // Crédito de comissão e notificações
      await creditAffiliateCommission(order.id);
      await triggerSaleCompleted(order.id, user.id, product.name, total);

      await ctx.editMessage(`✅ Compra realizada com sucesso!\n\n` +
        `📦 Produto: ${product.name}\n` +
        `🔢 Quantidade: ${quantity}\n` +
        `💰 Total: ${formatCurrency(total)}\n` +
        `🆔 Pedido: ${order.id}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📱 Receber por WhatsApp', callback_data: `entregar_whatsapp_${order.id}` }],
            [{ text: '📧 Receber por e-mail', callback_data: `entregar_email_${order.id}` }],
            [{ text: '⏮️ Voltar', callback_data: 'voltar_inicio' }],
          ],
        },
      });
    } catch (error: any) {
      await ctx.editMessage(`❌ ${error.message}`);
    }
  } else {
    // Saldo insuficiente: gera Pix e reserva estoque
    const faltante = total - balance;
    await ctx.editMessage(`❌ Saldo insuficiente!\n\n` +
      `💰 Seu saldo: ${formatCurrency(balance)}\n` +
      `💵 Valor total: ${formatCurrency(total)}\n` +
      `📉 Faltam: ${formatCurrency(faltante)}\n\n` +
      `💡 Gerar Pix para pagar?`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💰 Gerar Pix', callback_data: `pix_comprar_${productId}_${quantity}` }],
          [{ text: '⏮️ Voltar', callback_data: 'voltar_produto' }],
        ],
      },
    });
  }
}

// Gera Pix para compra (com reserva de estoque)
export async function startPurchasePix(ctx: Context, productId: number, quantity: number) {
  // Verifica anti-flood
  if (await actionRateLimit(ctx, 'pix_generate')) return;

  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
  if (!user) return;

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return;

  const total = parseFloat(product.price.toString()) * quantity;

  try {
    // Reserva estoque
    const unitIds = await reserveStock(productId, quantity, user.id);

    // Gera pagamento
    const paymentData = await generatePixPayment(total, user.id, `Compra: ${product.name}`);

    // Cria pedido com status RESERVED
    const order = await prisma.order.create({
      data: {
        userId: user.id,
        productId,
        quantity,
        unitPrice: product.price,
        totalPrice: total,
        status: 'RESERVED',
      },
    });

    // Salva pagamento associado ao pedido
    const dbPayment = await prisma.payment.create({
      data: {
        userId: user.id,
        orderId: order.id,
        method: 'PIX',
        status: 'PENDING',
        amount: total,
        externalId: paymentData.externalId ? String(paymentData.externalId) : null,
        qrCode: paymentData.qrCode,
        qrCodeImage: paymentData.qrCodeImage,
        expiresAt: paymentData.expiresAt,
      },
    });

    // Associa as unidades reservadas ao pedido
    await prisma.stockUnit.updateMany({
      where: { id: { in: unitIds } },
      data: { orderId: order.id },
    });

    // Monta mensagem do Pix
    const pixConfig = await getPixConfig();
    let text = `💰 Pagamento via Pix\n\n` +
      `Produto: ${product.name}\n` +
      `Quantidade: ${quantity}\n` +
      `Valor total: ${formatCurrency(total)}\n` +
      `Expira em: ${pixConfig.expirationMinutes} min\n` +
      `ID do pagamento: ${dbPayment.id}\n\n` +
      (paymentData.qrCode ? `💎 Pix Copia e Cola:\n<code>${paymentData.qrCode}</code>\n\n` : '');

    const inlineKeyboard = [];
    if (pixConfig.showCopyButton && paymentData.qrCode) {
      inlineKeyboard.push([{ text: '📋 Copiar código Pix', callback_data: `pix_copy_${dbPayment.id}` }]);
    }
    inlineKeyboard.push([{ text: '🔄 Já paguei', callback_data: `pix_check_compra_${dbPayment.id}` }]);
    inlineKeyboard.push([{ text: '⏮️ Voltar', callback_data: 'voltar_inicio' }]);

    // Envia mensagem com QR Code se disponível
    if (pixConfig.showQrCode && paymentData.qrCodeImage) {
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
    // Libera estoque se algo falhar
    await ctx.editMessage(`❌ ${error.message}`);
  }
}

// Verifica pagamento Pix de compra
export async function checkPurchasePix(ctx: Context, paymentId: number) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: { include: { stockUnits: true } }, user: true },
  });

  if (!payment || payment.status !== 'PENDING') return;

  try {
    const status = await checkPixPaymentStatus(payment.externalId!);
    if (status === 'APPROVED') {
      // Processa pagamento e confirma venda
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'APPROVED', paidAt: new Date() },
        });
        await tx.order.update({
          where: { id: payment.orderId! },
          data: { status: 'PAID' },
        });
        const unitIds = payment.order?.stockUnits.map(u => u.id) || [];
        await confirmSale(unitIds, payment.orderId!);
        // Aplica bônus? Se for recarga, aqui é compra, não precisa bônus.
      });

      // Comissão e notificação
      await creditAffiliateCommission(payment.orderId!);
      await triggerPaymentApproved(payment.id, payment.userId, parseFloat(payment.amount.toString()), 'PIX');
      await triggerSaleCompleted(payment.orderId!, payment.userId, payment.order?.product.name || '', parseFloat(payment.amount.toString()));

      await ctx.editMessage('✅ Pagamento aprovado! Compra concluída.');
    } else if (status === 'CANCELLED' || status === 'EXPIRED') {
      // Libera reserva
      if (payment.orderId) {
        const order = await prisma.order.findUnique({
          where: { id: payment.orderId },
          include: { stockUnits: true },
        });
        if (order && order.status === 'RESERVED') {
          const unitIds = order.stockUnits.map(u => u.id);
          await releaseReservation(unitIds);
          await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
        }
      }
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'EXPIRED' } });
      await ctx.editMessage('⌛️ Pagamento expirado. Estoque liberado.');
    } else {
      await ctx.editMessage('⏳ Pagamento ainda pendente.');
    }
  } catch (error) {
    console.error(error);
    await ctx.editMessage('❌ Erro ao verificar pagamento.');
  }
}
