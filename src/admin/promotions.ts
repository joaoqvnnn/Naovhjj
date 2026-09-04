import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';

export async function showPromotionsMenu(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  await ctx.editMessage('📣 Promoções e Cupons\n\nEscolha:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '➕ Nova promoção agendada', callback_data: 'promo_new_scheduled' }],
        [{ text: '🎁 Nova campanha de cupom', callback_data: 'promo_new_coupon' }],
        [{ text: '📋 Listar promoções', callback_data: 'promo_list' }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_menu_actions' }],
      ],
    },
  });
}

export async function createScheduledPromotion(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  await startCapture(ctx, 'promo_message', 'Digite o texto da promoção:', {
    validate: async (input) => input.trim().length > 0 ? null : 'Texto vazio.',
    onSuccess: async (ctx, message) => {
      await startCapture(ctx, 'promo_datetime', 'Digite data e hora (DD/MM/AAAA HH:mm:ss):', {
        validate: async (input) => {
          const regex = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/;
          return regex.test(input) ? null : 'Formato inválido.';
        },
        onSuccess: async (ctx, datetime) => {
          const [datePart, timePart] = datetime.split(' ');
          const [day, month, year] = datePart.split('/').map(Number);
          const [hours, minutes, seconds] = timePart.split(':').map(Number);
          const scheduledAt = new Date(year, month - 1, day, hours, minutes, seconds);

          await ctx.editMessage('Escolha o segmento:', {
            reply_markup: {
              inline_keyboard: [
                [{ text: 'Todos', callback_data: `promo_segment_all` }],
                [{ text: 'Ativos', callback_data: `promo_segment_active` }],
                [{ text: 'Compradores', callback_data: `promo_segment_buyers` }],
                [{ text: 'Afiliados', callback_data: `promo_segment_affiliates` }],
              ],
            },
          });

          ctx.session.data = { promoMessage: message, promoScheduledAt: scheduledAt };
        },
      });
    },
  });
}

export async function finalizeScheduledPromotion(ctx: Context, segment: string) {
  const { promoMessage, promoScheduledAt } = ctx.session.data;
  if (!promoMessage || !promoScheduledAt) return ctx.editMessage('Dados incompletos.');

  await prisma.scheduledPromotion.create({
    data: {
      message: promoMessage,
      scheduledAt: new Date(promoScheduledAt),
      segment,
      sent: false,
    },
  });

  await ctx.editMessage('✅ Promoção agendada!');
  ctx.session.data = {};
}

export async function createCouponPromotion(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  await startCapture(ctx, 'coupon_value', 'Digite o valor do cupom (ex: 5.00):', {
    validate: async (input) => {
      const num = parseFloat(input.replace(',', '.'));
      return isNaN(num) || num <= 0 ? 'Valor inválido.' : null;
    },
    onSuccess: async (ctx, value) => {
      const couponValue = parseFloat(value.replace(',', '.'));

      await startCapture(ctx, 'coupon_validity', 'Digite a validade em horas:', {
        validate: async (input) => {
          const num = parseInt(input);
          return isNaN(num) || num <= 0 ? 'Inválido.' : null;
        },
        onSuccess: async (ctx, hours) => {
          const expiresAt = new Date(Date.now() + parseInt(hours) * 60 * 60 * 1000);

          await prisma.couponPromotion.create({
            data: { value: couponValue, expiresAt, isActive: true },
          });

          await ctx.editMessage(`✅ Campanha criada!\nValor: R$ ${couponValue.toFixed(2)}\nExpira em: ${hours} horas`);
        },
      });
    },
  });
}

export async function listPromotions(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const scheduled = await prisma.scheduledPromotion.findMany({ where: { sent: false }, orderBy: { scheduledAt: 'asc' } });
  const coupons = await prisma.couponPromotion.findMany({ where: { isActive: true } });

  const text = `📋 Promoções Agendadas:\n` +
    scheduled.map(p => `#${p.id} - ${p.scheduledAt.toLocaleString('pt-BR')} - ${p.segment}`).join('\n') + '\n\n' +
    `🎁 Campanhas de Cupom:\n` +
    coupons.map(c => `#${c.id} - R$ ${c.value} - Expira ${c.expiresAt.toLocaleString('pt-BR')}`).join('\n');

  await ctx.editMessage(text || 'Nenhuma promoção.', {
    reply_markup: { inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'promo_menu' }]] },
  });
}
