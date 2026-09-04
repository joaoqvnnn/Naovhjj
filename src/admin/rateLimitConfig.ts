import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';
import { logAction } from '../services/logger';

const ACTIONS = ['pix_generate', 'giftcard_attempt', 'password_attempt', 'withdrawal_attempt', 'coupon_activate'];

export async function showRateLimitConfig(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const settings = await prisma.setting.findMany({
    where: { key: { startsWith: 'ratelimit_' } },
  });

  const map = new Map(settings.map(s => [s.key, s.value as any]));

  let text = 'Anti-Flood por Ação\n\n';
  for (const action of ACTIONS) {
    const config = map.get(`ratelimit_${action}`) || { max: 5, intervalSec: 60, blockSec: 300 };
    text += `${action}: max ${config.max}, intervalo ${config.intervalSec}s, bloqueio ${config.blockSec}s\n`;
  }

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        ...ACTIONS.map(action => [{ text: `Editar ${action}`, callback_data: `ratelimit_edit_${action}` }]),
        [{ text: 'Voltar', callback_data: 'admin_actions_antiflood' }],
      ],
    },
  });
}

export async function editRateLimitConfig(ctx: Context, action: string) {
  if (!(await isAdmin(ctx))) return;

  await startCapture(ctx, `ratelimit_${action}`, `Digite os valores para ${action} no formato: max,intervalo,bloqueio\nExemplo: 5,60,300`, {
    validate: async (input) => {
      const parts = input.split(',').map(p => parseInt(p.trim()));
      if (parts.length !== 3 || parts.some(isNaN)) return 'Formato inválido. Use max,intervalo,bloqueio';
      return null;
    },
    onSuccess: async (ctx, value) => {
      const [max, intervalSec, blockSec] = value.split(',').map(Number);
      await prisma.setting.upsert({
        where: { key: `ratelimit_${action}` },
        update: { value: { max, intervalSec, blockSec } },
        create: { key: `ratelimit_${action}`, value: { max, intervalSec, blockSec } },
      });
      await logAction({ action: 'RATE_LIMIT_CONFIG_UPDATED', details: { action, max, intervalSec, blockSec } });
      await ctx.editMessage('Limites atualizados.');
      await showRateLimitConfig(ctx);
    },
  });
}
