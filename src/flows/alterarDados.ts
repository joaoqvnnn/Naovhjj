import { Context } from '../types/context';
import prisma from '../database';
import { startCapture } from '../middlewares/capture';
import { normalizePhone } from '../utils/phoneValidation';

// Inicia alteração de WhatsApp
export async function startChangeWhatsApp(ctx: Context) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });

  if (!user) return;

  const currentPhone = user.whatsapp || 'Não informado';

  await startCapture(ctx, 'change_whatsapp', `📱 Seu WhatsApp atual: ${currentPhone}\n\nDigite o novo número (com DDD, pode incluir +55 ou não):`, {
    validate: async (input) => {
      const normalized = normalizePhone(input);
      if (!normalized) {
        return '❌ Número inválido. Digite no formato correto, ex: +55 (44) 99999-9999 ou 44999999999.';
      }
      return null;
    },
    onSuccess: async (ctx, rawPhone) => {
      const normalized = normalizePhone(rawPhone)!;
      await prisma.user.update({
        where: { id: user.id },
        data: { whatsapp: normalized },
      });
      await ctx.editMessage(`✅ WhatsApp atualizado para: ${normalized}`);
    },
  });
}
