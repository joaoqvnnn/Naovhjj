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

// Função para navegar para uma tela (edita a mensagem se existir, senão envia)
export async function goToScreen(ctx: Context, screenId: string, data?: any) {
  const screen = getScreen(screenId);
  if (!screen) {
    console.error(`Tela não encontrada: ${screenId}`);
    return;
  }

  const result = await screen.render(ctx, data);

  // Se temos uma mensagem anterior para editar, editamos
  if (ctx.session.messageIdToEdit && ctx.session.chatId) {
    try {
      if (result.imageUrl) {
        // Se houver imagem, enviamos como mídia (mais complexo, por enquanto só texto)
        // Para simplificar, editamos a legenda se for mídia; se for texto, editamos normalmente.
        await ctx.telegram.editMessageText(
          ctx.session.chatId,
          ctx.session.messageIdToEdit,
          undefined,
          result.text,
          result.keyboard ? { reply_markup: result.keyboard } : undefined
        );
      } else {
        await ctx.telegram.editMessageText(
          ctx.session.chatId,
          ctx.session.messageIdToEdit,
          undefined,
          result.text,
          result.keyboard ? { reply_markup: result.keyboard } : undefined
        );
      }
    } catch (error: any) {
      // Se a edição falhar (ex: mensagem original deletada), envia nova
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
    // Não há mensagem para editar, envia nova e armazena ID
    const sent = await ctx.reply(result.text, result.keyboard ? { reply_markup: result.keyboard } : {});
    if (sent.message_id) {
      ctx.session.messageIdToEdit = sent.message_id;
      ctx.session.chatId = ctx.chat!.id;
    }
  }

  // Atualiza tela atual/anterior
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
    // Volta para o início
    await goToScreen(ctx, 'start');
  }
}

// Middleware para injetar helpers no contexto
export function attachScreenManager(ctx: Context, next: () => Promise<void>) {
  ctx.session = ctx.session || {
    data: {},
  };
  ctx.goToScreen = (screenId, data) => goToScreen(ctx, screenId, data);
  ctx.goBack = () => goBack(ctx);
  ctx.editMessage = async (text, extra, options) => {
    if (ctx.session.messageIdToEdit && ctx.session.chatId) {
      try {
        await ctx.telegram.editMessageText(
          ctx.session.chatId,
          ctx.session.messageIdToEdit,
          undefined,
          text,
          extra
        );
        return true;
      } catch {
        // fallback: envia nova
        return false;
      }
    }
    return false;
  };
  return next();
}
