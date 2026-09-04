import { Context } from '../types/context';
import { startAISupport, transferToHuman, exitSupport } from '../flows/aiSupport';

export async function handleAttendanceButton(ctx: Context) {
  await ctx.answerCbQuery();
  await startAISupport(ctx);
}

export async function handleHumanButton(ctx: Context) {
  await ctx.answerCbQuery();
  await transferToHuman(ctx);
}

export async function handleExitSupport(ctx: Context) {
  await ctx.answerCbQuery();
  await exitSupport(ctx);
}
