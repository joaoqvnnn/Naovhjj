import { Context } from '../types/context';
import prisma from '../database';
import { formatCurrency, formatDate } from '../utils/format';
import { goToScreen } from '../screens/manager';
import { startCapture } from '../middlewares/capture';
import { reserveStock, releaseReservation, confirmSale, getAvailableStock } from '../services/stock';
import { mercadopago } from '../services/mercadopago';
import { sendPurchaseEmail } from '../services/email';
import { sendWhatsAppDelivery } from '../services/whatsapp';

// Mostra tela de produto
export async function showProduct(ctx: Context, productId: number) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { category: true },
  });

  if (!product || !product.isActive) {
    await ctx.editMessage('❌ Produto não encontrado ou desativado.', {
      reply_markup: { inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'voltar' }]] },
    });
    return;
  }

  const available = await getAvailableStock(productId);
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });

  const text = `🔥 ${product.emoji || ''} ${product.name}\n\n` +
    `🟢 DISPONÍVEL AGORA\n` +
    `├ 💵 Preço: ${formatCurrency(product.price)}\n` +
    `├ 💰 Seu Saldo: ${formatCurrency(user?.balance || 0)}\n` +
    `└ 📦 Estoque: ${available}\n\n` +
    `${product.description ? `📝 ${product.description}\n\n` : ''}` +
    `${product.guarantee ? `🛡 Garantia: ${product.guarantee}\n` : ''}`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '💳 Comprar', callback_data: `comprar_${product.id}` }],
      [{ text: '🛒 Comprar mais de um', callback_data: `comprar_qtd_${product.id}` }],
      [{ text: '⏮️ Voltar', callback_data: 'voltar_categoria' }],
    ],
  };

  await ctx.editMessage(text, { reply_markup: keyboard });
}

// Inicia compra com quantidade 1
export async function buyProduct(ctx: Context, productId: number) {
  await processPurchase(ctx, productId, 1);
}

// Inicia captura de quantidade para compra múltipla
export async function buyProductQuantity(ctx: Context, productId: number) {
  const available = await getAvailableStock(productId);
  if (available <= 0) {
    await ctx.editMessage('❌ Produto sem estoque no momento.', {
      reply_markup: { inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'voltar_categoria' }]] },
    });
    return;
  }

  await startCapture(ctx, 'quantidade', `Quantos logins deseja comprar?\n📦 Estoque disponível: ${available}\n\nDigite a quantidade:`, {
    validate: async (input) => {
      const qty = parseInt(input);
      if (isNaN(qty) || qty < 1) return '❌ Quantidade inválida. Digite um número maior que zero.';
      if (qty > available) return `❌ Quantidade indisponível. Estoque atual: ${available}.`;
      return null;
    },
    onSuccess: async (ctx, value) => {
      const qty = parseInt(value);
      await processPurchase(ctx, productId, qty);
    },
  });
}

// Processa a compra (verifica saldo, reserva estoque, gera pagamento se necessário)
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
      // Reserva estoque
      const unitIds = await reserveStock(productId, quantity, user.id);
      // Debita saldo
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: user.id },
          data: { balance: { decrement: total } },
        });
        // Cria pedido
        const order = await tx.order.create({
          data: {
            userId: user.id,
            productId,
            quantity,
            unitPrice: product.price,
            totalPrice: total,
            status: 'PAID',
            deliveryMethod: 'TELEGRAM', // padrão, depois pode escolher
          },
        });
        // Confirma venda
        await confirmSale(unitIds, order.id);
      });
      // Envia compra no Telegram
      await ctx.editMessage(`✅ Compra realizada com sucesso!\n\n` +
        `📦 Produto: ${product.name}\n` +
        `🔢 Quantidade: ${quantity}\n` +
        `💰 Total: ${formatCurrency(total)}\n` +
        `🆔 Pedido: ${/* pegar ID */ ''}`, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '📱 Receber por WhatsApp', callback_data: `entregar_whatsapp_${/*orderId*/ ''}` }],
            [{ text: '📧 Receber por e-mail', callback_data: `entregar_email_${/*orderId*/ ''}` }],
            [{ text: '⏮️ Voltar', callback_data: 'voltar_inicio' }],
          ],
        },
      });
    } catch (error: any) {
      await ctx.editMessage(`❌ ${error.message}`);
    }
  } else {
    // Saldo insuficiente: mostra opção de gerar Pix (recarregar) ou voltar
    const faltante = total - balance;
    await ctx.editMessage(`❌ Saldo insuficiente!\n\n` +
      `💰 Seu saldo: ${formatCurrency(balance)}\n` +
      `💵 Valor total: ${formatCurrency(total)}\n` +
      `📉 Faltam: ${formatCurrency(faltante)}\n\n` +
      `💡 Deseja gerar um PIX para recarregar?`, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💰 Gerar Pix', callback_data: `pix_recarregar_${faltante.toFixed(2)}` }],
          [{ text: '⏮️ Voltar', callback_data: 'voltar_produto' }],
        ],
      },
    });
  }
}

// Função para processar pagamento Pix (chamada quando o usuário clica em "Gerar Pix")
export async function startPixPayment(ctx: Context, amount: number) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
  if (!user) return;

  try {
    // Cria pagamento no Mercado Pago
    const payment = await mercadopago.createPixPayment(amount, 'Recarga de saldo', `recarga_${user.id}_${Date.now()}`);

    // Salva Payment no banco
    const dbPayment = await prisma.payment.create({
      data: {
        userId: user.id,
        method: 'PIX',
        status: 'PENDING',
        amount,
        externalId: String(payment.id),
        qrCode: payment.qrCode,
        qrCodeImage: payment.qrCodeImage,
        expiresAt: payment.expiresAt,
      },
    });

    // Mostra QR Code e instruções
    await ctx.editMessage(`💰 Comprar Saldo com Pix Automático\n\n` +
      `⏱️ Expira em: 10 minutos\n` +
      `💵 Valor: ${formatCurrency(amount)}\n` +
      `✨ ID da Recarga: ${dbPayment.id}\n\n` +
      `💎 Pix Copia e Cola:\n<code>${payment.qrCode}</code>\n\n` +
      `Após o pagamento, o saldo será creditado automaticamente.`, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔄 Já paguei', callback_data: `verificar_pix_${dbPayment.id}` }],
          [{ text: '⏮️ Voltar', callback_data: 'voltar_inicio' }],
        ],
      },
    });
  } catch (error: any) {
    await ctx.editMessage(`❌ ${error.message}`);
  }
}

// Verifica status do pagamento Pix
export async function checkPixPayment(ctx: Context, paymentId: number) {
  try {
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment || payment.status !== 'PENDING') return;

    const status = await mercadopago.getPaymentStatus(parseInt(payment.externalId!));
    if (status === 'APPROVED') {
      // Processa crédito
      await prisma.$transaction(async (tx) => {
        // Atualiza pagamento
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'APPROVED', paidAt: new Date() },
        });
        // Credita saldo do usuário
        await tx.user.update({
          where: { id: payment.userId },
          data: { balance: { increment: payment.amount } },
        });
        // Cria Recharge
        await tx.recharge.create({
          data: {
            userId: payment.userId,
            amount: payment.amount,
            paymentId: payment.id,
            status: 'APPROVED',
          },
        });
      });
      await ctx.editMessage('✅ Pagamento aprovado! Saldo creditado com sucesso.');
    } else if (status === 'CANCELLED' || status === 'EXPIRED') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'EXPIRED' },
      });
      await ctx.editMessage('⌛️ Pagamento expirado ou cancelado. Gere um novo Pix se necessário.');
    } else {
      await ctx.editMessage('⏳ Pagamento ainda pendente. Aguarde a confirmação do banco.');
    }
  } catch (error) {
    console.error('Erro ao verificar Pix:', error);
    await ctx.editMessage('❌ Erro ao verificar pagamento. Tente novamente.');
  }
}
