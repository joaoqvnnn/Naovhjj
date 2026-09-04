import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';
import { logAction } from '../services/logger';

// Tipos de botões suportados no broadcast
type BroadcastButtonType = 'comprar' | 'adicionar_saldo' | 'cadastrar' | 'suporte' | 'link';

interface BroadcastButton {
  text: string;
  type: BroadcastButtonType;
  value?: string; // produto ID, URL, etc.
}

// Mostra menu de transmissão com botões
export async function showBroadcastMenuWithButtons(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  await ctx.editMessage('📢 TRANSMISSÃO COM BOTÕES\n\nEscolha o segmento:', {
    reply_markup: {
      inline_keyboard: [
        [{ text: '👥 Todos', callback_data: 'bcast_all' }],
        [{ text: '🟢 Ativos', callback_data: 'bcast_active' }],
        [{ text: '🛒 Compradores', callback_data: 'bcast_buyers' }],
        [{ text: '🤝 Afiliados', callback_data: 'bcast_affiliates' }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_actions_broadcast' }],
      ],
    },
  });
}

// Inicia captura do texto da transmissão
export async function startBroadcastText(ctx: Context, segment: string) {
  if (!(await isAdmin(ctx))) return;

  // Salva segmento na sessão
  ctx.session.data = { ...ctx.session.data, broadcastSegment: segment };

  await startCapture(ctx, 'broadcast_text', 'Digite o texto da mensagem:', {
    validate: async (input) => input.trim().length > 0 ? null : 'Texto vazio.',
    onSuccess: async (ctx, text) => {
      ctx.session.data = { ...ctx.session.data, broadcastText: text };
      await showButtonOptions(ctx);
    },
  });
}

// Mostra opções de botões para adicionar
async function showButtonOptions(ctx: Context) {
  const currentButtons = ctx.session.data?.broadcastButtons || [];
  const buttonList = currentButtons.map((b: BroadcastButton, i: number) => `${i + 1}. ${b.text} (${b.type})`).join('\n') || 'Nenhum botão adicionado.';

  await ctx.editMessage(`Botões atuais:\n${buttonList}\n\nEscolha uma ação:`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '➕ Adicionar botão Comprar', callback_data: 'bcast_btn_comprar' }],
        [{ text: '➕ Adicionar botão Saldo', callback_data: 'bcast_btn_saldo' }],
        [{ text: '➕ Adicionar botão Cadastrar', callback_data: 'bcast_btn_cadastrar' }],
        [{ text: '➕ Adicionar botão Suporte', callback_data: 'bcast_btn_suporte' }],
        [{ text: '➕ Adicionar botão Link', callback_data: 'bcast_btn_link' }],
        [{ text: '✅ Enviar agora', callback_data: 'bcast_send' }],
        [{ text: '❌ Cancelar', callback_data: 'bcast_cancel' }],
      ],
    },
  });
}

// Adiciona botão de comprar
export async function addBuyButton(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'bcast_btn_comprar', 'Digite o ID do produto para o botão Comprar:', {
    validate: async (input) => /^\d+$/.test(input) ? null : 'ID inválido.',
    onSuccess: async (ctx, productId) => {
      const product = await prisma.product.findUnique({ where: { id: parseInt(productId) } });
      if (!product) return ctx.editMessage('Produto não encontrado.');
      const buttons = ctx.session.data?.broadcastButtons || [];
      buttons.push({ text: `🛒 Comprar ${product.name}`, type: 'comprar', value: productId });
      ctx.session.data = { ...ctx.session.data, broadcastButtons: buttons };
      await showButtonOptions(ctx);
    },
  });
}

// Adiciona botão de adicionar saldo
export async function addBalanceButton(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const buttons = ctx.session.data?.broadcastButtons || [];
  buttons.push({ text: '💰 Adicionar Saldo', type: 'adicionar_saldo' });
  ctx.session.data = { ...ctx.session.data, broadcastButtons: buttons };
  await showButtonOptions(ctx);
}

// Adiciona botão de cadastrar
export async function addRegisterButton(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const buttons = ctx.session.data?.broadcastButtons || [];
  buttons.push({ text: '📝 Cadastrar', type: 'cadastrar' });
  ctx.session.data = { ...ctx.session.data, broadcastButtons: buttons };
  await showButtonOptions(ctx);
}

// Adiciona botão de suporte
export async function addSupportButton(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const supportLink = await prisma.setting.findUnique({ where: { key: 'support_link' } });
  const buttons = ctx.session.data?.broadcastButtons || [];
  buttons.push({ text: '🆘 Suporte', type: 'suporte', value: supportLink?.value || '' });
  ctx.session.data = { ...ctx.session.data, broadcastButtons: buttons };
  await showButtonOptions(ctx);
}

// Adiciona botão de link
export async function addLinkButton(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'bcast_btn_link', 'Digite a URL do link:', {
    validate: async (input) => input.startsWith('http') ? null : 'URL inválida.',
    onSuccess: async (ctx, url) => {
      const buttons = ctx.session.data?.broadcastButtons || [];
      buttons.push({ text: '🔗 Link', type: 'link', value: url });
      ctx.session.data = { ...ctx.session.data, broadcastButtons: buttons };
      await showButtonOptions(ctx);
    },
  });
}

// Envia a transmissão com botões
export async function sendBroadcastWithButtons(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const text = ctx.session.data?.broadcastText;
  const segment = ctx.session.data?.broadcastSegment;
  const buttons = ctx.session.data?.broadcastButtons || [];

  if (!text || !segment) {
    await ctx.editMessage('❌ Dados incompletos.');
    return;
  }

  // Constroi teclado inline
  const inlineKeyboard = buttons.map((b: BroadcastButton) => {
    switch (b.type) {
      case 'comprar':
        return [{ text: b.text, callback_data: `comprar_${b.value}` }];
      case 'adicionar_saldo':
        return [{ text: b.text, callback_data: 'menu_recarregar' }];
      case 'cadastrar':
        return [{ text: b.text, callback_data: 'start' }];
      case 'suporte':
        return [{ text: b.text, url: b.value || 'https://t.me/larizinhastorebot' }];
      case 'link':
        return [{ text: b.text, url: b.value }];
      default:
        return [];
    }
  }).filter(row => row.length > 0);

  // Determina filtro de segmento
  let whereClause: any = {};
  switch (segment) {
    case 'all': whereClause = {}; break;
    case 'active': whereClause = { status: 'ACTIVE' }; break;
    case 'buyers': whereClause = { orders: { some: {} } }; break;
    case 'affiliates': whereClause = { affiliateBalance: { gt: 0 } }; break;
  }

  const users = await prisma.user.findMany({
    where: whereClause,
    select: { telegramId: true, status: true },
  });

  let sent = 0;
  const bot = (await import('../bot')).default;
  for (const user of users) {
    if (user.status === 'BLOCKED') continue; // não envia para bloqueados
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
