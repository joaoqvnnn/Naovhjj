import { Context } from '../types/context';
import prisma from '../database';
import { formatCurrency } from '../utils/format';
import { goToScreen } from '../screens/manager';

export async function cmdPix(ctx: Context) {
  const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ') : [];
  if (args.length < 2) {
    await ctx.reply('Envie /pix e o valor. Ex: /pix 10');
    return;
  }
  const valor = parseFloat(args[1].replace(',', '.'));
  if (isNaN(valor) || valor <= 0) {
    await ctx.reply('Valor inválido.');
    return;
  }
  const { startPixPayment } = await import('../flows/pixPayment');
  await startPixPayment(ctx, valor);
}

export async function cmdHistorico(ctx: Context) {
  await goToScreen(ctx, 'historico');
}

export async function cmdAlerta(ctx: Context) {
  await goToScreen(ctx, 'alertas');
}

export async function cmdTermos(ctx: Context) {
  const template = await prisma.messageTemplate.findUnique({ where: { key: 'termos' } });
  await ctx.reply(template?.text || 'Termos de uso não configurados.');
}

export async function cmdRanking(ctx: Context) {
  await goToScreen(ctx, 'ranking');
}

export async function cmdSaldo(ctx: Context) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
  if (!user) return;
  await ctx.reply(`💰 Saldo: ${formatCurrency(user.balance)}`);
}

export async function cmdId(ctx: Context) {
  await ctx.reply(`🆔 Seu ID: ${ctx.from!.id}`);
}

export async function cmdAfiliados(ctx: Context) {
  await goToScreen(ctx, 'afiliados');
}
