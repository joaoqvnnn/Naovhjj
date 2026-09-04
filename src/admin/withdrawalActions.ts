import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { processWithdrawal } from '../services/payout';
import { logAction } from '../services/logger';
import { startCapture } from '../middlewares/capture';

// Aprovar saque manualmente (pagamento realizado fora do sistema)
export async function approveWithdrawal(ctx: Context, withdrawalId: number) {
  if (!(await isAdmin(ctx))) return;
  const withdrawal = await prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
  if (!withdrawal) return ctx.editMessage('Saque não encontrado.');
  if (withdrawal.status === 'PAID') return ctx.editMessage('Saque já pago.');

  await prisma.$transaction(async (tx) => {
    await tx.withdrawal.update({
      where: { id: withdrawalId },
      data: { status: 'PAID', processedAt: new Date() },
    });
    await tx.log.create({
      data: {
        userId: withdrawal.userId,
        action: 'WITHDRAWAL_APPROVED_MANUAL',
        details: { withdrawalId, by: ctx.from?.id },
      },
    });
  });

  await ctx.editMessage(`✅ Saque #${withdrawalId} aprovado e marcado como pago.`);
}

// Rejeitar saque e devolver saldo ao usuário
export async function rejectWithdrawal(ctx: Context, withdrawalId: number) {
  if (!(await isAdmin(ctx))) return;

  await startCapture(ctx, 'saque_reject_motivo', 'Digite o motivo da rejeição:', {
    validate: async (input) => input ? null : 'Digite um motivo.',
    onSuccess: async (ctx, motivo) => {
      const withdrawal = await prisma.withdrawal.findUnique({ where: { id: withdrawalId } });
      if (!withdrawal) return ctx.editMessage('Saque não encontrado.');

      await prisma.$transaction(async (tx) => {
        await tx.withdrawal.update({
          where: { id: withdrawalId },
          data: { status: 'REJECTED' },
        });
        // Devolve o valor ao saldo de comissão
        await tx.user.update({
          where: { id: withdrawal.userId },
          data: { affiliateBalance: { increment: withdrawal.amount } },
        });
        await tx.log.create({
          data: {
            userId: withdrawal.userId,
            action: 'WITHDRAWAL_REJECTED',
            details: { withdrawalId, motivo, by: ctx.from?.id },
          },
        });
      });

      await ctx.editMessage(`❌ Saque #${withdrawalId} rejeitado. Saldo devolvido ao usuário.`);
    },
  });
}

// Reprocessar saque (chama o serviço de payout novamente)
export async function reprocessWithdrawal(ctx: Context, withdrawalId: number) {
  if (!(await isAdmin(ctx))) return;
  const result = await processWithdrawal(withdrawalId, ctx.from?.id);
  await ctx.editMessage(`${result.message}`);
}
