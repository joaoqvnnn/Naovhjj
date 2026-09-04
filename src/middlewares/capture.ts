import { Context } from '../types/context';

export async function startCapture(
  ctx: Context,
  field: string,
  promptMessage: string,
  options: {
    validate?: (input: string) => Promise<string | null>;
    onSuccess: (ctx: Context, value: string) => Promise<void>;
  }
) {
  ctx.session.waitingFor = field;
  ctx.session.captureField = field;
  ctx.session.captureValidate = options.validate;
  ctx.session.captureOnSuccess = options.onSuccess;

  // Edita a mensagem atual em vez de enviar nova
  if (ctx.session.messageIdToEdit && ctx.session.chatId) {
    await ctx.telegram.editMessageText(
      ctx.session.chatId,
      ctx.session.messageIdToEdit,
      undefined,
      promptMessage,
      {
        reply_markup: {
          inline_keyboard: [[{ text: '❌ Cancelar', callback_data: 'capture_cancel' }]],
        },
      }
    );
  } else {
    const sent = await ctx.reply(promptMessage, {
      reply_markup: {
        inline_keyboard: [[{ text: '❌ Cancelar', callback_data: 'capture_cancel' }]],
      },
    });
    if (sent.message_id) {
      ctx.session.messageIdToEdit = sent.message_id;
      ctx.session.chatId = ctx.chat!.id;
    }
  }
}

export async function captureMiddleware(ctx: Context, next: () => Promise<void>) {
  if (!ctx.session.waitingFor || !ctx.session.captureField || !ctx.message || !('text' in ctx.message)) {
    return next();
  }

  const text = ctx.message.text;

  if (text === '/cancelar') {
    await cancelCapture(ctx);
    return;
  }

  const validate = ctx.session.captureValidate;
  if (validate) {
    const error = await validate(text);
    if (error) {
      if (ctx.session.messageIdToEdit && ctx.session.chatId) {
        await ctx.telegram.editMessageText(
          ctx.session.chatId,
          ctx.session.messageIdToEdit,
          undefined,
          error,
          {
            reply_markup: {
              inline_keyboard: [[{ text: '❌ Cancelar', callback_data: 'capture_cancel' }]],
            },
          }
        );
      }
      return;
    }
  }

  const onSuccess = ctx.session.captureOnSuccess;
  if (onSuccess) {
    const success = onSuccess;
    clearCaptureState(ctx);
    await success(ctx, text);
    return;
  }

  clearCaptureState(ctx);
  await next();
}

export async function cancelCapture(ctx: Context) {
  clearCaptureState(ctx);
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

export async function captureCancelCallback(ctx: Context) {
  await ctx.answerCbQuery();
  await cancelCapture(ctx);
}
