import prisma from '../database';
import { processWithdrawal } from '../services/payout';
import { logAction } from '../services/logger';

// Intervalo em milissegundos (padrão 60s)
const INTERVAL = 60 * 1000;

// Função que processa todos os saques pendentes
export async function processPendingWithdrawals() {
  try {
    const pendingWithdrawals = await prisma.withdrawal.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: 10, // limite para não sobrecarregar
    });

    for (const withdrawal of pendingWithdrawals) {
      try {
        const result = await processWithdrawal(withdrawal.id);
        if (!result.success) {
          await logAction({
            action: 'AUTO_WITHDRAWAL_FAILED',
            userId: withdrawal.userId,
            details: { withdrawalId: withdrawal.id, message: result.message },
          });
        }
      } catch (error) {
        console.error(`Erro no processamento automático do saque #${withdrawal.id}:`, error);
      }
      // Pequeno delay entre processamentos
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  } catch (error) {
    console.error('Erro no worker de saques:', error);
  }
}

// Inicia o worker
export function startWithdrawalWorker() {
  console.log('🔄 Worker de saques iniciado.');
  // Executa imediatamente e depois a cada INTERVAL
  processPendingWithdrawals().catch(console.error);
  setInterval(() => {
    processPendingWithdrawals().catch(console.error);
  }, INTERVAL);
}
