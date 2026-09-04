import prisma from '../database';
import config from '../config';
import { logAction } from './logger';
import axios from 'axios';

// Interface para configuração de payout (pode vir de Setting)
interface PayoutConfig {
  provider: 'mercadopago' | 'manual';
  apiUrl?: string;
  token?: string;
  minAmount: number;
  maxAmount: number;
}

// Obtém configuração de payout do banco
async function getPayoutConfig(): Promise<PayoutConfig> {
  const setting = await prisma.setting.findUnique({ where: { key: 'payout_config' } });
  if (setting) return setting.value as PayoutConfig;
  // Padrão: manual
  return { provider: 'manual', minAmount: 0, maxAmount: 0 };
}

// Processa uma solicitação de saque (automático ou manual)
export async function processWithdrawal(withdrawalId: number, adminUserId?: number): Promise<{ success: boolean; message: string }> {
  const config = await getPayoutConfig();

  // Busca o saque com bloqueio pessimista para evitar duplicidade
  return await prisma.$transaction(async (tx) => {
    const withdrawal = await tx.withdrawal.findUnique({
      where: { id: withdrawalId },
      include: { user: true },
    });

    if (!withdrawal) throw new Error('Saque não encontrado.');
    if (withdrawal.status === 'PAID') return { success: true, message: 'Saque já pago.' };
    if (withdrawal.status === 'PROCESSING') return { success: false, message: 'Saque em processamento.' };
    if (withdrawal.status === 'REJECTED') return { success: false, message: 'Saque rejeitado anteriormente.' };

    // Marca como processing
    await tx.withdrawal.update({
      where: { id: withdrawal.id },
      data: { status: 'PROCESSING' },
    });

    try {
      if (config.provider === 'manual') {
        // Modo manual: apenas registra que foi marcado como processado por admin
        // O admin deverá confirmar posteriormente (ver withdrawalActions)
        return { success: true, message: 'Saque marcado para processamento manual.' };
      }

      // Provedor automático (ex: Mercado Pago Payout)
      if (!config.apiUrl || !config.token) {
        throw new Error('Configuração de payout automático incompleta.');
      }

      // Monta payload conforme provedor
      const payload = {
        amount: parseFloat(withdrawal.amount.toString()),
        description: `Saque #${withdrawal.id} - ${withdrawal.user.username}`,
        method: withdrawal.method === 'PIX' ? 'pix' : 'bank_transfer',
        pix_key: withdrawal.pixKey || undefined,
        bank_details: withdrawal.bankDetails || undefined,
      };

      // Simula chamada à API (substituir por implementação real do provedor)
      const response = await axios.post(config.apiUrl, payload, {
        headers: { Authorization: `Bearer ${config.token}` },
      });

      // Verifica resposta (exemplo: { status: 'approved', external_id: '...' })
      if (response.data?.status === 'approved') {
        // Atualiza como pago
        await tx.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: 'PAID',
            externalId: response.data.external_id || null,
            processedAt: new Date(),
          },
        });
        await logAction({ action: 'WITHDRAWAL_AUTO_PAID', userId: withdrawal.userId, details: { withdrawalId: withdrawal.id } });
        return { success: true, message: 'Saque pago automaticamente.' };
      } else {
        // Falha no provedor, reverte para PENDING
        await tx.withdrawal.update({
          where: { id: withdrawal.id },
          data: { status: 'PENDING' },
        });
        return { success: false, message: 'Falha no provedor: status não aprovado.' };
      }
    } catch (error: any) {
      // Em caso de erro, reverte para PENDING para permitir nova tentativa
      await tx.withdrawal.update({
        where: { id: withdrawal.id },
        data: { status: 'PENDING' },
      });
      await logAction({ action: 'WITHDRAWAL_PROCESS_ERROR', userId: withdrawal.userId, details: { withdrawalId: withdrawal.id, error: error.message } });
      return { success: false, message: `Erro: ${error.message}` };
    }
  });
}
