import { Context } from '../types/context';
import prisma from '../database';
import { formatCurrency } from '../utils/format';
import { goToScreen } from '../screens/manager';

// Comando /saldo
export async function cmdSaldo(ctx: Context) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
  if (!user) return ctx.reply('Usuário não encontrado.');
  await ctx.reply(`💰 Seu saldo atual: ${formatCurrency(user.balance)}`);
}

// Comando /id
export async function cmdId(ctx: Context) {
  await ctx.reply(`🆔 Seu Telegram ID: ${ctx.from!.id}`);
}

// Comando /pix [valor]
export async function cmdPix(ctx: Context) {
  const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ') : [];
  if (args.length < 2) {
    // Mostra tela de recarga
    await goToScreen(ctx, 'recarregar');
    return;
  }
  const valor = parseFloat(args[1].replace(',', '.'));
  if (isNaN(valor) || valor <= 0) {
    await ctx.reply('❌ Formato inválido. Use /pix 10 ou /pix 10.50');
    return;
  }
  // Inicia pagamento Pix
  const { startPixPayment } = await import('../flows/purchase');
  await startPixPayment(ctx, valor);
}

// Comando /historico
export async function cmdHistorico(ctx: Context) {
  await goToScreen(ctx, 'historico');
}

// Comando /ranking
export async function cmdRanking(ctx: Context) {
  await goToScreen(ctx, 'ranking');
}

// Comando /afiliados
export async function cmdAfiliados(ctx: Context) {
  await goToScreen(ctx, 'afiliados');
}

// Registra todos os comandos no bot
export function registerCommands(bot: any) {
  bot.command('saldo', cmdSaldo);
  bot.command('id', cmdId);
  bot.command('pix', cmdPix);
  bot.command('historico', cmdHistorico);
  bot.command('ranking', cmdRanking);
  bot.command('afiliados', cmdAfiliados);
  // Outros comandos podem ser adicionados
}
