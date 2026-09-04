import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';

export async function showBroadcastMenuWithButtons(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  await ctx.editMessage('📢 Transmissão com botões\n\nEscolha o segmento:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '👥 Todos', callback_data: 'bcast_all' }],
        [{ text: '🟢 Ativos', callback_data: 'bcast_active' }],
        [{ text: '🛒 Compradores', callback_data: 'bcast_buyers' }],
        [{ text: '🤝 Afiliados', callback_data: 'bcast_affiliates' }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_menu_actions' }],
      ],
    },
  });
}

export async function startBroadcastText(ctx: Context, segment: string) {
  if (!(await isAdmin(ctx))) return;

  await startCapture(ctx, 'broadcast_text', 'Digite o texto da transmissão:', {
    validate: async (input) => input.trim().length > 0 ? null : 'Texto vazio.',
    onSuccess: async (ctx, text) => {
      ctx.session.data = { ...ctx.session.data, broadcastText: text, segment };
      await ctx.editMessage('Deseja adicionar botões?', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '➕ Botão Comprar', callback_data: 'bcast_btn_comprar' }],
            [{ text: '➕ Botão Saldo', callback_data: 'bcast_btn_saldo' }],
            [{ text: '➕ Botão Cadastrar', callback_data: 'bcast_btn_cadastrar' }],
            [{ text: '➕ Botão Suporte', callback_data: 'bcast_btn_suporte' }],
            [{ text: '✅ Enviar agora', callback_data: 'bcast_send' }],
            [{ text: '❌ Cancelar', callback_data: 'bcast_cancel' }],
          ],
        },
      });
    },
  });
}

export async function addBuyButton(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'bcast_btn_comprar', 'Digite o ID do produto:', {
    validate: async (input) => /^\d+$/.test(input) ? null : 'ID inválido.',
    onSuccess: async (ctx, productId) => {
      const product = await prisma.product.findUnique({ where: { id: parseInt(productId) } });
      if (!product) return ctx.editMessage('Produto não encontrado.');
      ctx.session.data = { ...ctx.session.data, broadcastButtons: [{ text: `🛒 Comprar ${product.name}`, callback_data: `comprar_${productId}` }] };
      await ctx.editMessage('✅ Botão adicionado. Envie agora?', {
        reply_markup: { inline_keyboard: [[{ text: '✅ Enviar', callback_data: 'bcast_send' }], [{ text: '❌ Cancelar', callback_data: 'bcast_cancel' }]] },
      });
    },
  });
}

export async function addBalanceButton(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  ctx.session.data = { ...ctx.session.data, broadcastButtons: [{ text: '💰 Adicionar Saldo', callback_data: 'menu_recarregar' }] };
  await ctx.editMessage('✅ Botão adicionado. Envie agora?', {
    reply_markup: { inline_keyboard: [[{ text: '✅ Enviar', callback_data: 'bcast_send' }], [{ text: '❌ Cancelar', callback_data: 'bcast_cancel' }]] },
  });
}

export async function addRegisterButton(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  ctx.session.data = { ...ctx.session.data, broadcastButtons: [{ text: '📝 Cadastrar', callback_data: 'start' }] };
  await ctx.editMessage('✅ Botão adicionado. Envie agora?', {
    reply_markup: { inline_keyboard: [[{ text: '✅ Enviar', callback_data: 'bcast_send' }], [{ text: '❌ Cancelar', callback_data: 'bcast_cancel' }]] },
  });
}

export async function addSupportButton(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const supportLink = await prisma.setting.findUnique({ where: { key: 'support_link' } });
  const link = supportLink?.value || 'https://t.me/larizinhastorebot';
  ctx.session.data = { ...ctx.session.data, broadcastButtons: [{ text: '🆘 Suporte', url: link }] };
  await ctx.editMessage('✅ Botão adicionado. Envie agora?', {
    reply_markup: { inline_keyboard: [[{ text: '✅ Enviar', callback_data: 'bcast_send' }], [{ text: '❌ Cancelar', callback_data: 'bcast_cancel' }]] },
  });
}

export async function addLinkButton(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'bcast_btn_link', 'Digite a URL do link:', {
    validate: async (input) => input.startsWith('http') ? null : 'URL inválida.',
    onSuccess: async (ctx, url) => {
      ctx.session.data = { ...ctx.session.data, broadcastButtons: [{ text: '🔗 Link', url }] };
      await ctx.editMessage('✅ Botão adicionado. Envie agora?', {
        reply_markup: { inline_keyboard: [[{ text: '✅ Enviar', callback_data: 'bcast_send' }], [{ text: '❌ Cancelar', callback_data: 'bcast_cancel' }]] },
      });
    },
  });
}

export async function sendBroadcastWithButtons(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const text = ctx.session.data?.broadcastText;
  const segment = ctx.session.data?.segment;
  const buttons = ctx.session.data?.broadcastButtons || [];

  if (!text || !segment) return ctx.editMessage('Dados incompletos.');

  let whereClause: any = {};
  switch (segment) {
    case 'all': whereClause = {}; break;
    case 'active': whereClause = { status: 'ACTIVE' }; break;
    case 'buyers': whereClause = { orders: { some: {} } }; break;
    case 'affiliates': whereClause = { affiliateBalance: { gt: 0 } }; break;
  }

  const users = await prisma.user.findMany({ where: whereClause, select: { telegramId: true, status: true } });

  const inlineKeyboard = buttons.map((b: any) => [b]);

  let sent = 0;
  const bot = (await import('../bot')).default;
  for (const user of users) {
    if (user.status === 'BLOCKED') continue;
    try {
      await bot.telegram.sendMessage(user.telegramId.toString(), text, {
        reply_markup: { inline_keyboard: inlineKeyboard },
      });
      sent++;
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      console.error(`Falha ao enviar para ${user.telegramId}:`, error);
    }
  }

  await ctx.editMessage(`✅ Transmissão enviada para ${sent} de ${users.length} usuários.`);
  ctx.session.data = {};
}
