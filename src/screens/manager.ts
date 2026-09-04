import { Context } from '../types/context';
import prisma from '../database';

// Tipo para definição de tela
interface ScreenDefinition {
  id: string;
  render: (ctx: Context, data?: any) => Promise<{
    text: string;
    keyboard?: any;
    imageUrl?: string;
  }>;
}

// Registro de telas
const screens = new Map<string, ScreenDefinition>();

export function registerScreen(screen: ScreenDefinition) {
  screens.set(screen.id, screen);
}

export function getScreen(id: string): ScreenDefinition | undefined {
  return screens.get(id);
}

// Função para navegar para uma tela
export async function goToScreen(ctx: Context, screenId: string, data?: any) {
  const screen = getScreen(screenId);
  if (!screen) {
    console.error(`Tela não encontrada: ${screenId}`);
    return;
  }

  const result = await screen.render(ctx, data);

  if (ctx.session.messageIdToEdit && ctx.session.chatId) {
    try {
      await ctx.telegram.editMessageText(
        ctx.session.chatId,
        ctx.session.messageIdToEdit,
        undefined,
        result.text,
        result.keyboard ? { reply_markup: result.keyboard } : undefined
      );
    } catch (error: any) {
      if (error.response?.error_code === 400) {
        const sent = await ctx.reply(result.text, result.keyboard ? { reply_markup: result.keyboard } : {});
        if (sent.message_id) {
          ctx.session.messageIdToEdit = sent.message_id;
          ctx.session.chatId = ctx.chat!.id;
        }
      } else {
        console.error('Erro ao editar mensagem:', error);
      }
    }
  } else {
    const sent = await ctx.reply(result.text, result.keyboard ? { reply_markup: result.keyboard } : {});
    if (sent.message_id) {
      ctx.session.messageIdToEdit = sent.message_id;
      ctx.session.chatId = ctx.chat!.id;
    }
  }

  ctx.session.previousScreen = ctx.session.currentScreen;
  ctx.session.currentScreen = screenId;
  ctx.session.data = data || {};
}

// Função para voltar
export async function goBack(ctx: Context) {
  const previous = ctx.session.previousScreen;
  if (previous) {
    await goToScreen(ctx, previous, ctx.session.data);
  } else {
    await goToScreen(ctx, 'start');
  }
}

// Middleware para injetar helpers no contexto
export function attachScreenManager(ctx: Context, next: () => Promise<void>) {
  ctx.session = ctx.session || { data: {} };
  ctx.goToScreen = (screenId, data) => goToScreen(ctx, screenId, data);
  ctx.goBack = () => goBack(ctx);
  return next();
}

// ==========================
// REGISTRO DA TELA ADMIN_START
// ==========================
registerScreen({
  id: 'admin_start',
  render: async (ctx: Context) => {
    const userId = ctx.from!.id;
    const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });
    if (!user || user.role === 'USER') {
      return { text: 'Acesso negado.' };
    }

    return {
      text: `Painel Admin\n\nBem-vindo, ${user.username || 'Admin'}!`,
      keyboard: {
        inline_keyboard: [
          [{ text: '📊 Dashboard', callback_data: 'admin_dashboard' }],
          [{ text: '⚙️ Configurações', callback_data: 'admin_menu_config' }],
          [{ text: '📦 Produtos', callback_data: 'admin_config_products' }],
          [{ text: '👥 Usuários', callback_data: 'admin_config_users' }],
        ],
      },
    };
  },
});
