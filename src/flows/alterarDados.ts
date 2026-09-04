import { Context } from '../types/context';
import prisma from '../database';
import { startCapture } from '../middlewares/capture';
import { normalizePhone } from '../utils/phoneValidation';

export async function showAlterarDados(ctx: Context) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });

  if (!user) return ctx.editMessageText('Usuário não encontrado.');

  await ctx.editMessageText(
    `✏️ Alterar Dados\n\n` +
    `📱 WhatsApp: ${user.whatsapp || 'Não informado'}\n\n` +
    `Selecione o dado para alterar:`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📱 WhatsApp', callback_data: 'alterar_whatsapp' }],
          [{ text: '⏮️ Voltar', callback_data: 'menu_perfil' }],
        ],
      },
    }
  );
}

export async function startChangeWhatsApp(ctx: Context) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });

  if (!user) return;

  await startCapture(ctx, 'change_whatsapp', 'Digite o novo número de WhatsApp (com DDD):', {
    validate: async (input) => {
      const normalized = normalizePhone(input);
      return normalized ? null : 'Número inválido. Use formato +55 (44) 99999-9999';
    },
    onSuccess: async (ctx, phone) => {
      const normalized = normalizePhone(phone)!;
      await prisma.user.update({ where: { id: user.id }, data: { whatsapp: normalized } });
      await ctx.editMessageText(`✅ WhatsApp atualizado para: ${normalized}`, {
        reply_markup: { inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'menu_perfil' }]] },
      });
    },
  });
}
