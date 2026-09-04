import { Context } from '../types/context';
import { actionRateLimit } from './actionRateLimit';
import { logAction } from '../services/logger';

/**
 * Wrapper para aplicar limite de ações específicas.
 * Retorna true se o usuário estiver bloqueado/limitado e a ação não deve prosseguir.
 * Retorna false se a ação pode continuar.
 *
 * Exemplo de uso:
 * if (await checkActionLimit(ctx, 'pix_generate')) return;
 */
export async function checkActionLimit(ctx: Context, action: string): Promise<boolean> {
  const blocked = await actionRateLimit(ctx, action);

  if (blocked) {
    // Registra tentativa bloqueada (opcional, mas recomendado para auditoria)
    const userId = ctx.from?.id;
    if (userId) {
      await logAction({
        action: `RATE_LIMIT_BLOCKED_${action.toUpperCase()}`,
        userId,
        details: { action },
      });
    }
  }

  return blocked;
}

// Exemplos de uso em outros fluxos:
// if (await checkActionLimit(ctx, 'pix_generate')) return;
// if (await checkActionLimit(ctx, 'giftcard_attempt')) return;
// if (await checkActionLimit(ctx, 'password_attempt')) return;
