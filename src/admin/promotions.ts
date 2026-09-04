import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';
import { logAction } from '../services/logger';

// Menu principal de promoções
export async function showPromotionsMenu(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await ctx.editMessage('📣 Promoções e Cupons\n\nEscolha uma ação:', {
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

// Inicia criação de promoção agendada
export async function createScheduledPromotion(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  await startCapture(ctx, 'promo_message', 'Digite o texto da promoção:', {
    validate: async (input) => input.trim().length > 0 ? null : 'Texto vazio.',
    onSuccess: async (ctx, message) => {
      ctx.session.data = { ...ctx.session.data, promoMessage: message };
      await ctx.editMessage('Agora digite a data e hora no formato:\n\nDD/MM/AAAA HH:mm:ss\n\nExemplo: 25/12/2024 15:30:00', {
        reply_markup: { inline_keyboard: [[{ text: '❌ Cancelar', callback_data: 'promo_cancel' }]] },
      });
      // Inicia captura da data
      await startCapture(ctx, 'promo_datetime', 'Digite a data e hora (DD/MM/AAAA HH:mm:ss):', {
        validate: async (input) => {
          const regex = /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/;
          return regex.test(input) ? null : 'Formato inválido. Use DD/MM/AAAA HH:mm:ss';
        },
        onSuccess: async (ctx, datetime) => {
          const [datePart, timePart] = datetime.split(' ');
          const [day, month, year] = datePart.split('/').map(Number);
          const [hours, minutes, seconds] = timePart.split(':').map(Number);
          const scheduledAt = new Date(year, month - 1, day, hours, minutes, seconds);

          // Seleciona segmento
          await ctx.editMessage('Escolha o segmento:', {
            reply_markup: {
              inline_keyboard: [
                [{ text: '👥 Todos', callback_data: `promo_segment_all` }],
                [{ text: '🟢 Ativos', callback_data: `promo_segment_active` }],
                [{ text: '🛒 Compradores', callback_data: `promo_segment_buyers` }],
                [{ text: '🤝 Afiliados', callback_data: `promo_segment_affiliates` }],
              ],
            },
          });

          ctx.session.data = {
            ...ctx.session.data,
            promoScheduledAt: scheduledAt,
            promoMessage: ctx.session.data.promoMessage,
          };
        },
      });
    },
  });
}

// Função para finalizar criação após escolher segmento
export async function finalizeScheduledPromotion(ctx: Context, segment: string) {
  const { promoMessage, promoScheduledAt } = ctx.session.data;
  if (!promoMessage || !promoScheduledAt) {
    await ctx.editMessage('Dados incompletos.');
    return;
  }

  await prisma.scheduledPromotion.create({
    data: {
      message: promoMessage,
      scheduledAt: new Date(promoScheduledAt),
      segment,
      sent: false,
    },
  });

  await logAction({ action: 'PROMOTION_SCHEDULED', details: { segment, scheduledAt: promoScheduledAt } });
  await ctx.editMessage('✅ Promoção agendada com sucesso!');
  ctx.session.data = {};
}

// Cria campanha de cupom
export async function createCouponPromotion(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  await startCapture(ctx, 'coupon_value', 'Digite o valor do cupom (ex: 5.00):', {
    validate: async (input) => {
      const num = parseFloat(input.replace(',', '.'));
      return isNaN(num) || num <= 0 ? 'Valor inválido.' : null;
    },
    onSuccess: async (ctx, value) => {
      const couponValue = parseFloat(value.replace(',', '.'));
      ctx.session.data = { ...ctx.session.data, couponValue };

      await startCapture(ctx, 'coupon_validity', 'Digite a validade em horas (ex: 24):', {
        validate: async (input) => {
          const num = parseInt(input);
          return isNaN(num) || num <= 0 ? 'Inválido.' : null;
        },
        onSuccess: async (ctx, hours) => {
          const expiresAt = new Date(Date.now() + parseInt(hours) * 60 * 60 * 1000);

          const promotion = await prisma.couponPromotion.create({
            data: {
              value: couponValue,
              expiresAt,
              isActive: true,
            },
          });

          await logAction({ action: 'COUPON_PROMOTION_CREATED', details: { value: couponValue, expiresAt } });
          await ctx.editMessage(`✅ Campanha de cupom criada!\nValor: R$ ${couponValue.toFixed(2)}\nExpira em: ${hours} horas`);
          ctx.session.data = {};
        },
      });
    },
  });
}

// Lista promoções ativas
export async function listPromotions(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const scheduled = await prisma.scheduledPromotion.findMany({ where: { sent: false }, orderBy: { scheduledAt: 'asc' } });
  const coupons = await prisma.couponPromotion.findMany({ where: { isActive: true } });

  const text = `📋 Promoções Agendadas:\n` +
    scheduled.map(p => `#${p.id} - ${p.scheduledAt.toLocaleString('pt-BR')} - ${p.segment}`).join('\n') + '\n\n' +
    `🎁 Campanhas de Cupom:\n` +
    coupons.map(c => `#${c.id} - R$ ${c.value} - Expira ${c.expiresAt.toLocaleString('pt-BR')}`).join('\n');

  await ctx.editMessage(text || 'Nenhuma promoção ativa.', {
    reply_markup: {
      inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'promo_menu' }]],
    },
  });
}
