import { Context } from '../types/context';
import prisma from '../database';
import { startCapture } from '../middlewares/capture';
import { formatCurrency, isValidPixKey } from '../utils/format';
import bcrypt from 'bcryptjs';
import { logAction } from '../services/logger';
import { isUserBlocked } from '../middlewares/blockedUser';

// Inicia o fluxo de saque
export async function startWithdrawal(ctx: Context) {
  const userId = ctx.from!.id;

  // Verifica se o usuário está bloqueado
  if (await isUserBlocked(userId)) {
    await ctx.editMessage('🚫 Você está bloqueado e não pode realizar saques.');
    return;
  }

  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(userId) },
  });

  if (!user) return ctx.editMessage('Usuário não encontrado.');

  const minWithdraw = await prisma.setting.findUnique({ where: { key: 'min_withdraw' } });
  const min = minWithdraw ? parseFloat(minWithdraw.value.toString()) : 20;

  if (user.affiliateBalance < min) {
    await ctx.editMessage(
      `❌ Saldo insuficiente para saque.\n` +
      `💰 Saldo atual: ${formatCurrency(user.affiliateBalance)}\n` +
      `📉 Mínimo: ${formatCurrency(min)}`
    );
    return;
  }

  // Verifica senha
  if (!user.passwordHash) {
    await ctx.editMessage('🔑 Você ainda não definiu uma senha de saque. Defina uma para continuar.', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔑 Criar senha', callback_data: 'aff_criar_senha' }],
          [{ text: '⏮️ Voltar', callback_data: 'voltar' }],
        ],
      },
    });
    return;
  }

  await startCapture(ctx, 'saque_senha', 'Digite sua senha de saque:', {
    validate: async (input) => {
      const valid = await bcrypt.compare(input, user.passwordHash!);
      if (!valid) return '❌ Senha incorreta.';
      return null;
    },
    onSuccess: async (ctx) => {
      // Senha correta: escolher método
      await showWithdrawalMethod(ctx);
    },
  });
}

// Mostra opções de método de saque
export async function showWithdrawalMethod(ctx: Context) {
  await ctx.editMessage(
    `💸 SAQUE\n\nEscolha o método de saque:`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💠 Pix', callback_data: 'saque_pix' }],
          [{ text: '🏦 Transferência bancária (Web)', url: `${process.env.WEB_URL}/saque` }],
          [{ text: '⏮️ Voltar', callback_data: 'menu_afiliados' }],
        ],
      },
    }
  );
}

// Inicia saque via Pix
export async function startPixWithdrawal(ctx: Context) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(userId) },
  });

  if (!user) return;

  await startCapture(ctx, 'saque_pix_key', 'Digite sua chave Pix (CPF, CNPJ, e-mail, telefone ou aleatória):', {
    validate: async (input) => {
      if (!isValidPixKey(input)) return '❌ Chave Pix inválida. Tente novamente.';
      return null;
    },
    onSuccess: async (ctx, pixKey) => {
      await processPixWithdrawal(ctx, user.id, pixKey);
    },
  });
}

// Processa o saque Pix com transação e bloqueio
async function processPixWithdrawal(ctx: Context, userId: number, pixKey: string) {
  try {
    // Transação para garantir que não haja saque duplicado
    const result = await prisma.$transaction(async (tx) => {
      // Bloqueia a linha do usuário para leitura/atualização
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, affiliateBalance: true },
      });

      if (!user) throw new Error('Usuário não encontrado');

      const amount = parseFloat(user.affiliateBalance.toString());
      if (amount <= 0) throw new Error('Saldo zero ou negativo');

      // Cria o registro de saque
      const withdrawal = await tx.withdrawal.create({
        data: {
          userId,
          amount,
          fee: 0, // taxa configurável depois
          netAmount: amount,
          method: 'PIX',
          pixKey,
          status: 'PENDING',
        },
      });

      // Desconta o saldo de comissão
      await tx.user.update({
        where: { id: userId },
        data: { affiliateBalance: 0 },
      });

      // Registra log
      await tx.log.create({
        data: {
          userId,
          action: 'WITHDRAWAL_REQUESTED',
          details: { withdrawalId: withdrawal.id, amount, pixKey },
        },
      });

      return withdrawal;
    });

    await ctx.editMessage(
      `✅ Solicitação de saque enviada!\n\n` +
      `💰 Valor: ${formatCurrency(result.amount)}\n` +
      `💠 Pix: ${pixKey}\n` +
      `Status: PENDENTE\n\n` +
      `Acompanhe pelo extrato.`
    );
  } catch (error: any) {
    console.error('Erro no saque Pix:', error);
    await ctx.editMessage(`❌ ${error.message || 'Erro ao processar saque. Tente novamente.'}`);
  }
}

// Extrato de saques
export async function showWithdrawalHistory(ctx: Context) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(userId) },
    include: { withdrawals: { orderBy: { createdAt: 'desc' }, take: 10 } },
  });

  if (!user) return;

  if (!user.withdrawals.length) {
    await ctx.editMessage('📭 Você ainda não solicitou nenhum saque.');
    return;
  }

  let text = `📊 Histórico de Saques\n\n`;
  for (const w of user.withdrawals) {
    text += `#${w.id} - ${formatCurrency(w.amount)} - ${w.method} - ${w.status} - ${w.createdAt.toLocaleDateString('pt-BR')}\n`;
  }

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'menu_afiliados' }]],
    },
  });
}

// Criação de senha de saque (fluxo em duas etapas com confirmação)
export async function startCreatePassword(ctx: Context) {
  await startCapture(ctx, 'saque_senha_nova', 'Digite a nova senha de saque (mínimo 6 caracteres):', {
    validate: async (input) => {
      if (input.length < 6) return '❌ A senha deve ter pelo menos 6 caracteres.';
      return null;
    },
    onSuccess: async (ctx, senha) => {
      await startCapture(ctx, 'saque_senha_confirm', 'Confirme a senha:', {
        validate: async (input) => {
          if (input !== senha) return '❌ As senhas não coincidem.';
          return null;
        },
        onSuccess: async (ctx, confirm) => {
          const hashed = await bcrypt.hash(senha, 10);
          await prisma.user.update({
            where: { id: ctx.from!.id },
            data: { passwordHash: hashed },
          });
          await ctx.editMessage('🔑 Senha de saque definida com sucesso!');
        },
      });
    },
  });
}
