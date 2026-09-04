import { Context } from '../types/context';
import prisma from '../database';
import { formatCurrency } from '../utils/format';
import { logAction } from '../services/logger';
import { startCapture } from '../middlewares/capture';

// Obtém configurações de pontos
async function getPointsConfig() {
  const pointsPerRecharge = await prisma.setting.findUnique({ where: { key: 'affiliate_points_per_recharge' } });
  const pointsMin = await prisma.setting.findUnique({ where: { key: 'affiliate_points_min' } });
  const multiplier = await prisma.setting.findUnique({ where: { key: 'affiliate_multiplier' } });

  return {
    pointsPerRecharge: pointsPerRecharge ? parseInt(pointsPerRecharge.value.toString()) : 1,
    pointsMin: pointsMin ? parseInt(pointsMin.value.toString()) : 500,
    multiplier: multiplier ? parseFloat(multiplier.value.toString()) : 0.01,
  };
}

// Função chamada quando um indicado recarrega: credita pontos para o afiliado
export async function creditAffiliatePoints(referrerUserId: number, rechargeAmount: number): Promise<void> {
  const config = await getPointsConfig();
  if (config.pointsPerRecharge <= 0) return;

  const points = config.pointsPerRecharge; // pontos fixos por recarga, independente do valor? ou baseado no valor?
  // Regra: pontos por recarga fixo, conforme configurado
  await prisma.user.update({
    where: { id: referrerUserId },
    data: { affiliatePoints: { increment: points } },
  });

  await logAction({
    action: 'AFFILIATE_POINTS_CREDITED',
    userId: referrerUserId,
    details: { points, rechargeAmount },
  });
}

// Converte pontos em saldo
export async function convertPointsToBalance(ctx: Context) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
  if (!user) return;

  const config = await getPointsConfig();

  // Verifica sistema de indicação ativo
  const systemOn = await prisma.setting.findUnique({ where: { key: 'affiliate_system' } });
  if (systemOn && !systemOn.value) {
    await ctx.editMessage('O sistema de indicação está desativado.');
    return;
  }

  if (user.affiliatePoints < config.pointsMin) {
    await ctx.editMessage(`❌ Pontos insuficientes. Mínimo: ${config.pointsMin} pontos. Você tem ${user.affiliatePoints}.`);
    return;
  }

  const valor = user.affiliatePoints * config.multiplier;
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        balance: { increment: valor },
        affiliatePoints: 0, // zera pontos após conversão
      },
    });
    await tx.log.create({
      data: {
        userId: user.id,
        action: 'AFFILIATE_POINTS_CONVERTED',
        details: { points: user.affiliatePoints, valor },
      },
    });
  });

  await ctx.editMessage(`✅ Pontos convertidos! Você recebeu ${formatCurrency(valor)} de saldo.`);
}

// Mostra tela de pontos para o cliente
export async function showAffiliatePoints(ctx: Context) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
  if (!user) return;

  const config = await getPointsConfig();
  const text = `💠 Pontos de Indicação\n\n` +
    `Seus pontos: ${user.affiliatePoints}\n` +
    `Pontos mínimos para converter: ${config.pointsMin}\n` +
    `Multiplicador: ${config.multiplier}\n` +
    `Valor atual: ${formatCurrency(user.affiliatePoints * config.multiplier)}`;

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔄 Converter em saldo', callback_data: 'aff_convert_points' }],
        [{ text: '⏮️ Voltar', callback_data: 'menu_afiliados' }],
      ],
    },
  });
}
