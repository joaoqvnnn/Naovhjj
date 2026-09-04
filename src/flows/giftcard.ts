import { Context } from '../types/context';
import prisma from '../database';
import { startCapture } from '../middlewares/capture';
import { formatCurrency } from '../utils/format';

export async function showGiftCardScreen(ctx: Context) {
  await startCapture(ctx, 'giftcard_code', '🎁 Digite o código do Gift Card:', {
    validate: async (input) => input.trim().length > 0 ? null : 'Código inválido.',
    onSuccess: async (ctx, code) => {
      await redeemGiftCard(ctx, code.trim().toUpperCase());
    },
  });
}

async function redeemGiftCard(ctx: Context, code: string) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });

  if (!user) return ctx.editMessageText('Usuário não encontrado.');

  const giftCard = await prisma.giftCard.findUnique({ where: { code } });

  if (!giftCard) {
    await ctx.editMessageText('❌ Gift Card não encontrado.');
    return;
  }

  if (giftCard.status !== 'ACTIVE') {
    await ctx.editMessageText('❌ Este Gift Card já foi utilizado ou está desativado.');
    return;
  }

  if (giftCard.expiresAt && giftCard.expiresAt < new Date()) {
    await prisma.giftCard.update({ where: { id: giftCard.id }, data: { status: 'EXPIRED' } });
    await ctx.editMessageText('❌ Este Gift Card expirou.');
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.giftCard.update({
      where: { id: giftCard.id },
      data: { status: 'USED', usedAt: new Date(), usedByUserId: user.id },
    });
    await tx.user.update({
      where: { id: user.id },
      data: { balance: { increment: giftCard.value } },
    });
  });

  await ctx.editMessageText(
    `✅ Gift Card resgatado!\n\n` +
    `Valor: ${formatCurrency(giftCard.value)}\n` +
    `Saldo atual: ${formatCurrency(user.balance)}`
  );
}
