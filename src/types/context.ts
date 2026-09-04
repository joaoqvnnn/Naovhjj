import { Context as TelegrafContext } from 'telegraf';
import { Message, Update } from 'telegraf/typings/core/types/typegram';

// Interface para sessão em memória (pode ser substituída por Redis depois)
export interface SessionData {
  userId?: number;
  currentScreen?: string;      // Identificador da tela atual
  previousScreen?: string;     // Para voltar
  data?: Record<string, any>;  // Dados temporários da navegação
  waitingFor?: string;         // Campo que estamos esperando capturar
  messageIdToEdit?: number;    // ID da mensagem que devemos editar
  chatId?: number;
}

// Interface para o estado de captura
export interface CaptureState {
  field: string;
  promptMessageId?: number;
  chatId?: number;
  validate?: (input: string) => Promise<string | null>; // retorna erro ou null
  onSuccess?: (ctx: Context, value: string) => Promise<void>;
}

// Extensão do Context
export interface Context extends TelegrafContext {
  session: SessionData;
  captureState?: CaptureState;
  // Helper para editar mensagem atual (screen manager)
  editMessage: (
    text: string,
    extra?: any,
    options?: { deletePrevious?: boolean }
  ) => Promise<Message.TextMessage | boolean>;
  // Helper para navegar para uma tela
  goToScreen: (screenId: string, data?: any) => Promise<void>;
  // Helper para voltar
  goBack: () => Promise<void>;
}
