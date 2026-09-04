import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';

export async function showInactivityConfig(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const setting = await prisma.setting.findUnique({ where: { key: 'inactivity_days' } });
  const days = setting ? parseInt(setting.value.toString()) : 90;

  await ctx.editMessage(`Inatividade\n\nDias para perder acesso: ${days}\n\nEscolha uma opção:`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Alterar dias', callback_data: 'inactivity_set_days' }],
        [{ text: 'Voltar', callback_data: 'admin_menu_actions' }],
      ],
    },
  });
}

export async function setInactivityDays(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  await startCapture(ctx, 'inactivity_days', 'Digite o número de dias para inatividade:', {
    validate: async (input) => {
      const num = parseInt(input);
      return isNaN(num) || num < 1 ? 'Valor inválido.' : null;
    },
    onSuccess: async (ctx, value) => {
      const days = parseInt(value);
      await prisma.setting.upsert({
        where: { key: 'inactivity_days' },
        update: { value: days },
        create: { key: 'inactivity_days', value: days },
      });
      await ctx.editMessage(`Inatividade configurada para ${days} dias.`);
      await showInactivityConfig(ctx);
    },
  });
}
