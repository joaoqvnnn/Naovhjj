import { Context } from '../types/context';
import { interpretMessage } from '../services/ai';
import { goToScreen } from '../screens/manager';
import { cmdSaldo, cmdHistorico, cmdRanking, cmdAfiliados, cmdTermos } from '../commands';
import { showAlertsScreen } from '../flows/alerts';
import { showGiftCardScreen } from '../flows/giftcard';
import { showWithdrawalMethod } from '../flows/withdrawal';
import { isAdmin } from '../admin/userManagement';

// Handler principal para mensagens naturais
export async function handleNaturalLanguage(ctx: Context, text: string) {
  const response = interpretMessage(text);
  const intent = response.intent;

  switch (intent) {
    case 'HISTORICO':
      await cmdHistorico(ctx);
      break;
    case 'COMPRAS_ATIVAS':
      // Pode filtrar apenas ativas (por enquanto usa histórico)
      await cmdHistorico(ctx);
      break;
    case 'SALDO':
      await cmdSaldo(ctx);
      break;
    case 'SACAR':
      // Verifica se é admin? Não, saque é para usuário comum
      await showWithdrawalMethod(ctx);
      break;
    case 'SALDO_AFILIADO':
      await cmdAfiliados(ctx);
      break;
    case 'RANKING':
      await cmdRanking(ctx);
      break;
    case 'ALERTA':
      await showAlertsScreen(ctx);
      break;
    case 'GIFT_CARD':
      await showGiftCardScreen(ctx);
      break;
    case 'SUPORTE':
      await cmdTermos(ctx); // pode ser substituído por suporte real
      break;
    case 'INICIO':
      await goToScreen(ctx, 'start');
      break;
    default:
      await ctx.reply(response.message || 'Não entendi. Use os botões do menu.');
  }
}
