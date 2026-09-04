import { Context } from '../types/context';
import prisma from '../database';
import { startCapture } from '../middlewares/capture';
import { formatCurrency, isValidPixKey } from '../utils/format';
import bcrypt from 'bcryptjs';

export async function showWithdrawalMethod(ctx: Context) {
  await ctx.editMessageText('💸 Saque\n\nEscolha o método:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💠 Pix', callback_data: 'saque_pix' }],
        [{ text: '🏦 Transferência bancária', url: `${process.env.WEB_URL}/web/saque` }],
        [{ text: '⏮️ Voltar', callback_data: 'menu_afiliados' }],
      ],
    },
  });
}

export async function startWithdrawal(ctx: Context) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });

  if (!user) return ctx.editMessageText('Usuário não encontrado.');

  const minWithdrawSetting = await prisma.setting.findUnique({ where: { key: 'min_withdraw' } });
  const min = minWithdrawSetting ? parseFloat(minWithdrawSetting.value.toString()) : 20;

  if (user.affiliateBalance < min) {
    await ctx.editMessageText(
      `❌ Saldo insuficiente para saque.\n\n` +
      `Saldo: ${formatCurrency(user.affiliateBalance)}\n` +
      `Mínimo: ${formatCurrency(min)}`
    );
    return;
  }

  if (!user.passwordHash) {
    await ctx.editMessageText('🔑 Você ainda não definiu uma senha de saque. Defina uma para continuar.', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔑 Criar senha', callback_data: 'create_password' }],
          [{ text: '⏮️ Voltar', callback_data: 'menu_afiliados' }],
        ],
      },
    });
    return;
  }

  await startCapture(ctx, 'saque_senha', 'Digite sua senha de saque:', {
    validate: async (input) => {
      const valid = await bcrypt.compare(input, user.passwordHash!);
      return valid ? null : 'Senha incorreta.';
    },
    onSuccess: async (ctx) => {
      await showWithdrawalMethod(ctx);
    },
  });
}

export async function startCreatePassword(ctx: Context) {
  await startCapture(ctx, 'saque_senha_nova', 'Digite a nova senha de saque (mínimo 6 caracteres):', {
    validate: async (input) => input.length >= 6 ? null : 'A senha deve ter pelo menos 6 caracteres.',
    onSuccess: async (ctx, senha) => {
      await startCapture(ctx, 'saque_senha_confirm', 'Confirme a senha:', {
        validate: async (input) => input === senha ? null : 'As senhas não coincidem.',
        onSuccess: async (ctx) => {
          const hashed = await bcrypt.hash(senha, 10);
          await prisma.user.update({
            where: { id: ctx.from!.id },
            data: { passwordHash: hashed },
          });
          await ctx.editMessageText('🔑 Senha de saque definida com sucesso!');
        },
      });
    },
  });
}

export async function startPixWithdrawal(ctx: Context) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });

  if (!user) return ctx.editMessageText('Usuário não encontrado.');

  await startCapture(ctx, 'saque_pix_key', 'Digite sua chave Pix:', {
    validate: async (input) => isValidPixKey(input) ? null : 'Chave Pix inválida.',
    onSuccess: async (ctx, pixKey) => {
      const amount = parseFloat(user.affiliateBalance.toString());

      await prisma.$transaction(async (tx) => {
        await tx.withdrawal.create({
          data: {
            userId: user.id,
            amount,
            fee: 0,
            netAmount: amount,
            method: 'PIX',
            pixKey,
            status: 'PENDING',
          },
        });
        await tx.user.update({
          where: { id: user.id },
          data: { affiliateBalance: 0 },
        });
      });

      await ctx.editMessageText(
        `✅ Solicitação de saque enviada!\n\n` +
        `Valor: ${formatCurrency(amount)}\n` +
        `Chave Pix: ${pixKey}\n` +
        `Status: PENDENTE`
      );
    },
  });
}

export async function showWithdrawalHistory(ctx: Context) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(userId) },
    include: { withdrawals: { orderBy: { createdAt: 'desc' }, take: 10 } },
  });

  if (!user) return;

  if (!user.withdrawals.length) {
    await ctx.editMessageText('📭 Você ainda não solicitou nenhum saque.', {
      reply_markup: {
        inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'menu_afiliados' }]],
      },
    });
    return;
  }

  let text = '📊 Histórico de Saques\n\n';
  user.withdrawals.forEach(w => {
    text += `#${w.id} - ${formatCurrency(w.amount)} - ${w.method} - ${w.status} - ${w.createdAt.toLocaleDateString('pt-BR')}\n`;
  });

  await ctx.editMessageText(text, {
    reply_markup: {
      inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'menu_afiliados' }]],
    },
  });
}
