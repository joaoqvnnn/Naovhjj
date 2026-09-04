import { Context } from '../types/context';
import { startAISupport, transferToHuman, exitSupport } from '../flows/aiSupport';

// Handler para o botão "Atendimento" no menu principal
export async function handleAttendanceButton(ctx: Context) {
  await ctx.answerCbQuery();
  await startAISupport(ctx);
}

// Handler para "Falar com humano"
export async function handleHumanButton(ctx: Context) {
  await ctx.answerCbQuery();
  await transferToHuman(ctx);
}

// Handler para "Encerrar atendimento"
export async function handleExitSupport(ctx: Context) {
  await ctx.answerCbQuery();
  await exitSupport(ctx);
}
