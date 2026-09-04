import { Context } from '../types/context';

// Armazenamento em memória (pode ser substituído por Redis em produção)
const sessions = new Map<number, SessionData>();

export interface SessionData {
  userId?: number;
  currentScreen?: string;
  previousScreen?: string;
  data?: Record<string, any>;
  waitingFor?: string;
  messageIdToEdit?: number;
  chatId?: number;
  captureField?: string;
  capturePromptMessageId?: number;
  captureChatId?: number;
  captureValidate?: (input: string) => Promise<string | null>;
  captureOnSuccess?: (ctx: Context, value: string) => Promise<void>;
}

function getSession(userId: number): SessionData {
  if (!sessions.has(userId)) {
    sessions.set(userId, { userId });
  }
  return sessions.get(userId)!;
}

export function clearSession(userId: number) {
  sessions.delete(userId);
}

export function setSession(userId: number, data: Partial<SessionData>) {
  const session = getSession(userId);
  Object.assign(session, data);
}

export function getSessionData(userId: number): SessionData {
  return getSession(userId);
}

// Middleware que injeta a sessão no contexto
export async function sessionMiddleware(ctx: Context, next: () => Promise<void>) {
  if (!ctx.from) return next();

  const userId = ctx.from.id;
  const session = getSession(userId);

  // Injeta no contexto
  ctx.session = session;

  // Helpers de navegação
  ctx.goToScreen = async (screenId: string, data?: any) => {
    // será importado e sobrescrito no manager, ou podemos implementar aqui
    // Para evitar dependência circular, importamos dinamicamente
    const { goToScreen } = await import('../screens/manager');
    await goToScreen(ctx, screenId, data);
  };

  ctx.goBack = async () => {
    const { goBack } = await import('../screens/manager');
    await goBack(ctx);
  };

  ctx.editMessage = async (text: string, extra?: any, options?: { deletePrevious?: boolean }) => {
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
      } catch (error: any) {
        if (error.response?.error_code === 400) {
          // Mensagem original não existe ou não pode ser editada, envia nova
          const sent = await ctx.reply(text, extra);
          if (sent.message_id) {
            ctx.session.messageIdToEdit = sent.message_id;
            ctx.session.chatId = ctx.chat!.id;
          }
          return true; // considera sucesso
        }
        console.error('Erro ao editar mensagem:', error);
        return false;
      }
    }
    // Se não há mensagem para editar, envia nova
    const sent = await ctx.reply(text, extra);
    if (sent.message_id) {
      ctx.session.messageIdToEdit = sent.message_id;
      ctx.session.chatId = ctx.chat!.id;
    }
    return true;
  };

  await next();
}
