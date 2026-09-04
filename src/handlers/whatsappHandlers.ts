import { Context } from '../types/context';
import { showWhatsAppAntiFloodConfig, setWhatsAppAntiFloodParam } from '../admin/whatsappAntiFloodConfig';

// Handler para menu de anti-flood do WhatsApp
export async function handleWhatsAppAntiFloodMenu(ctx: Context) {
  await ctx.answerCbQuery();
  await showWhatsAppAntiFloodConfig(ctx);
}

// Handler para definir parâmetros do anti-flood do WhatsApp
export async function handleWhatsAppAntiFloodSet(ctx: Context, param: string) {
  await ctx.answerCbQuery();
  await setWhatsAppAntiFloodParam(ctx, param);
}
