import { Context } from '../types/context';
import prisma from '../database';
import { startCapture } from '../middlewares/capture';
import { formatCurrency } from '../utils/format';
import { goToScreen } from '../screens/manager';

// Tela: Resgatar Gift Card
export async function showGiftCardScreen(ctx: Context) {
  await ctx.editMessage(
    `🎁 RESGATAR GIFT CARD\n\n` +
    `Digite o código do seu Gift Card para adicionar o saldo à sua carteira.`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '❌ Cancelar', callback_data: 'capture_cancel' }],
        ],
      },
    }
  );

  // Inicia captura do código
  await startCapture(ctx, 'giftcard_code', 'Digite o código do Gift Card:', {
    validate: async (input) => {
      const code = input.trim().toUpperCase();
      if (code.length < 4) return '❌ Código inválido. Tente novamente.';
      return null;
    },
    onSuccess: async (ctx, input) => {
      await redeemGiftCard(ctx, input.trim().toUpperCase());
    },
  });
}

// Processa o resgate
async function redeemGiftCard(ctx: Context, code: string) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(userId) },
  });

  if (!user) {
    await ctx.editMessage('❌ Usuário não encontrado.');
    return;
  }

  // Busca o Gift Card pelo código
  const giftCard = await prisma.giftCard.findUnique({
    where: { code },
  });

  if (!giftCard) {
    await ctx.editMessage('❌ Gift Card não encontrado.');
    return;
  }

  // Validações
  if (giftCard.status !== 'ACTIVE') {
    await ctx.editMessage('❌ Este Gift Card já foi utilizado ou está desativado.');
    return;
  }

  if (giftCard.expiresAt && giftCard.expiresAt < new Date()) {
    await ctx.editMessage('❌ Este Gift Card expirou.');
    // Atualiza status para EXPIRED
    await prisma.giftCard.update({
      where: { id: giftCard.id },
      data: { status: 'EXPIRED' },
    });
    return;
  }

  // Tudo OK: processa resgate em transação
  try {
    await prisma.$transaction(async (tx) => {
      // Marca Gift Card como usado
      await tx.giftCard.update({
        where: { id: giftCard.id },
        data: {
          status: 'USED',
          usedAt: new Date(),
          usedByUserId: user.id,
        },
      });

      // Credita saldo na carteira
      await tx.user.update({
        where: { id: user.id },
        data: {
          balance: { increment: giftCard.value },
        },
      });

      // Registra log
      await tx.log.create({
        data: {
          userId: user.id,
          action: 'GIFT_CARD_REDEEMED',
          details: { code, value: giftCard.value.toString() },
        },
      });
    });

    await ctx.editMessage(
      `✅ Gift Card resgatado com sucesso!\n\n` +
      `💵 Valor creditado: ${formatCurrency(giftCard.value)}\n` +
      `💰 Seu saldo atual: ${formatCurrency(user.balance.add(giftCard.value))}`
    );
  } catch (error) {
    console.error('Erro ao resgatar Gift Card:', error);
    await ctx.editMessage('❌ Erro ao processar o resgate. Tente novamente.');
  }
}
