import prisma from '../database';
import config from '../config';
import axios from 'axios';
import { logAction } from './logger';

interface PayoutConfig {
  provider: 'mercadopago';
  accessToken: string;
  minAmount: number;
}

async function getConfig(): Promise<PayoutConfig> {
  const setting = await prisma.setting.findUnique({ where: { key: 'payout_config' } });
  if (setting) return setting.value as PayoutConfig;
  return { provider: 'mercadopago', accessToken: config.mpAccessToken, minAmount: 0 };
}

export async function processPayout(withdrawalId: number): Promise<boolean> {
  const cfg = await getConfig();
  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id: withdrawalId },
    include: { user: true },
  });
  if (!withdrawal || withdrawal.status === 'PAID') return false;

  try {
    // Marca como processando
    await prisma.withdrawal.update({ where: { id: withdrawalId }, data: { status: 'PROCESSING' } });

    // Chama API de payout do Mercado Pago (exemplo)
    const response = await axios.post('https://api.mercadopago.com/v1/payments', {
      transaction_amount: parseFloat(withdrawal.amount.toString()),
      description: `Saque #${withdrawal.id}`,
      payment_method_id: withdrawal.method === 'PIX' ? 'pix' : 'account_money',
      payer: { email: withdrawal.user.email || 'cliente@exemplo.com' },
      // ... demais campos necessários
    }, {
      headers: { Authorization: `Bearer ${cfg.accessToken}` },
    });

    if (response.data?.status === 'approved') {
      await prisma.withdrawal.update({
        where: { id: withdrawalId },
        data: { status: 'PAID', externalId: String(response.data.id), processedAt: new Date() },
      });
      // Notifica usuário via bot (pode ser adicionado)
      await logAction({ action: 'WITHDRAWAL_AUTO_PAID', userId: withdrawal.userId, details: { withdrawalId } });
      return true;
    } else {
      await prisma.withdrawal.update({ where: { id: withdrawalId }, data: { status: 'PENDING' } });
      return false;
    }
  } catch (error) {
    await prisma.withdrawal.update({ where: { id: withdrawalId }, data: { status: 'PENDING' } });
    await logAction({ action: 'WITHDRAWAL_PROCESS_ERROR', details: { withdrawalId, error: String(error) } });
    return false;
  }
}
