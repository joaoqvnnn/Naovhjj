import { Context } from '../types/context';
import prisma from '../database';
import { startCapture } from '../middlewares/capture';
import { formatCurrency, isValidPixKey } from '../utils/format';
import bcrypt from 'bcryptjs';

// Tela principal de afiliados (já registrada em menu.ts, mas expandida)
export async function showAffiliateScreen(ctx: Context) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(userId) },
  });

  if (!user) return ctx.editMessage('Usuário não encontrado.');

  const commissionRate = await prisma.setting.findUnique({ where: { key: 'commission_rate' } });
  const minWithdraw = await prisma.setting.findUnique({ where: { key: 'min_withdraw' } });

  const rate = commissionRate ? parseFloat(commissionRate.value.toString()) : 10;
  const min = minWithdraw ? parseFloat(minWithdraw.value.toString()) : 20;

  const text = `🤝 AFILIADOS\n\n` +
    `💰 Comissão: ${rate}%\n` +
    `📊 Saldo de comissão: ${formatCurrency(user.affiliateBalance)}\n` +
    `🔗 Seu link: https://t.me/larizinhastorebot?start=${userId}\n\n` +
    `Mínimo para saque: ${formatCurrency(min)}`;

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '💸 Sacar', callback_data: 'aff_sacar' }],
        [{ text: '📊 Extrato de saques', callback_data: 'aff_extrato' }],
        [{ text: '🔑 Criar/alterar senha', callback_data: 'aff_senha' }],
        [{ text: '⏮️ Voltar', callback_data: 'voltar' }],
      ],
    },
  });
}

// Inicia fluxo de saque
export async function startWithdrawal(ctx: Context) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(userId) },
  });

  if (!user) return;

  const minWithdrawSetting = await prisma.setting.findUnique({ where: { key: 'min_withdraw' } });
  const min = minWithdrawSetting ? parseFloat(minWithdrawSetting.value.toString()) : 20;

  if (user.affiliateBalance < min) {
    await ctx.editMessage(
      `❌ Saldo insuficiente para saque.\n` +
      `💰 Saldo atual: ${formatCurrency(user.affiliateBalance)}\n` +
      `📉 Mínimo: ${formatCurrency(min)}`
    );
    return;
  }

  // Verifica se tem senha de saque
  if (!user.passwordHash) {
    await ctx.editMessage(
      `🔑 Você ainda não definiu uma senha de saque.\n` +
      `Defina uma senha para continuar.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔑 Criar senha', callback_data: 'aff_criar_senha' }],
            [{ text: '⏮️ Voltar', callback_data: 'voltar' }],
          ],
        },
      }
    );
    return;
  }

  // Pede senha de saque
  await startCapture(ctx, 'saque_senha', 'Digite sua senha de saque:', {
    validate: async (input) => {
      const valid = await bcrypt.compare(input, user.passwordHash!);
      if (!valid) return '❌ Senha incorreta.';
      return null;
    },
    onSuccess: async (ctx) => {
      // Senha correta: prossegue para escolha do método
      await showWithdrawalMethod(ctx);
    },
  });
}

// Mostra opções de método de saque (Pix ou banco via Web)
export async function showWithdrawalMethod(ctx: Context) {
  await ctx.editMessage(
    `💸 SAQUE\n\nEscolha o método de saque:`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '💠 Pix', callback_data: 'aff_saque_pix' }],
          [{ text: '🏦 Transferência bancária (Web)', url: `${process.env.WEB_URL}/saque` }],
          [{ text: '⏮️ Voltar', callback_data: 'voltar' }],
        ],
      },
    }
  );
}

// Inicia captura da chave Pix
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
      // Cria solicitação de saque
      const amount = parseFloat(user.affiliateBalance.toString());
      await prisma.withdrawal.create({
        data: {
          userId: user.id,
          amount,
          fee: 0, // sem taxa por padrão
          netAmount: amount,
          method: 'PIX',
          pixKey,
          status: 'PENDING',
        },
      });

      // Zera saldo de comissão (ou desconta; depende da regra de negócio)
      await prisma.user.update({
        where: { id: user.id },
        data: { affiliateBalance: 0 },
      });

      await ctx.editMessage(
        `✅ Solicitação de saque enviada!\n\n` +
        `💰 Valor: ${formatCurrency(amount)}\n` +
        `💠 Pix: ${pixKey}\n` +
        `Status: PENDENTE`
      );
    },
  });
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

// Criação de senha de saque (fluxo em duas etapas)
export async function startCreatePassword(ctx: Context) {
  await startCapture(ctx, 'saque_senha_nova', 'Digite a nova senha de saque (mínimo 6 caracteres):', {
    validate: async (input) => {
      if (input.length < 6) return '❌ A senha deve ter pelo menos 6 caracteres.';
      return null;
    },
    onSuccess: async (ctx, senha) => {
      // Confirmação
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
