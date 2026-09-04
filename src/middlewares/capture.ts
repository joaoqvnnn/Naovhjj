import { Context } from '../types/context';
import { clearSession } from './session';

// Inicia um estado de captura
export async function startCapture(
  ctx: Context,
  field: string,
  promptMessage: string,
  options: {
    validate?: (input: string) => Promise<string | null>;
    onSuccess: (ctx: Context, value: string) => Promise<void>;
  }
) {
  // Salva o estado de captura na sessão
  ctx.session.waitingFor = field;
  ctx.session.captureField = field;
  ctx.session.captureValidate = options.validate;
  ctx.session.captureOnSuccess = options.onSuccess;

  // Edita ou envia a mensagem de prompt
  const sent = await ctx.reply(promptMessage, {
    reply_markup: {
      inline_keyboard: [[{ text: '❌ Cancelar', callback_data: 'capture_cancel' }]],
    },
  });

  // Guarda o ID da mensagem de prompt para editar depois (opcional)
  ctx.session.capturePromptMessageId = sent.message_id;
  ctx.session.captureChatId = ctx.chat!.id;
}

// Middleware que verifica se estamos esperando captura e processa a mensagem
export async function captureMiddleware(ctx: Context, next: () => Promise<void>) {
  // Se não há estado de captura, segue para o próximo middleware
  if (!ctx.session.waitingFor || !ctx.session.captureField || !ctx.message || !('text' in ctx.message)) {
    return next();
  }

  const text = ctx.message.text;

  // Trata comando /cancelar
  if (text === '/cancelar') {
    await cancelCapture(ctx);
    return;
  }

  // Validação
  const validate = ctx.session.captureValidate;
  if (validate) {
    const error = await validate(text);
    if (error) {
      // Mensagem de erro, mantém captura
      await ctx.reply(error, {
        reply_markup: {
          inline_keyboard: [[{ text: '❌ Cancelar', callback_data: 'capture_cancel' }]],
        },
      });
      return;
    }
  }

  // Sucesso: executa callback
  const onSuccess = ctx.session.captureOnSuccess;
  if (onSuccess) {
    // Limpa estado de captura antes de executar callback
    const field = ctx.session.captureField;
    const success = onSuccess;
    clearCaptureState(ctx);
    await success(ctx, text);
    return;
  }

  // Se não há callback, limpa e segue
  clearCaptureState(ctx);
  await next();
}

// Cancela a captura atual e volta para a tela anterior
export async function cancelCapture(ctx: Context) {
  clearCaptureState(ctx);
  // Volta para a tela anterior ou para o início
  if (ctx.session.previousScreen) {
    const { goToScreen } = await import('../screens/manager');
    await goToScreen(ctx, ctx.session.previousScreen, ctx.session.data);
  } else {
    const { goToScreen } = await import('../screens/manager');
    await goToScreen(ctx, 'start');
  }
}

function clearCaptureState(ctx: Context) {
  ctx.session.waitingFor = undefined;
  ctx.session.captureField = undefined;
  ctx.session.captureValidate = undefined;
  ctx.session.captureOnSuccess = undefined;
  ctx.session.capturePromptMessageId = undefined;
  ctx.session.captureChatId = undefined;
}

// Callback do botão "Cancelar" no teclado inline
export async function captureCancelCallback(ctx: Context) {
  await ctx.answerCbQuery();
  await cancelCapture(ctx);
}
