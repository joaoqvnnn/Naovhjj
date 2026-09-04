import prisma from '../database';
import { notifyAdmins } from '../services/adminNotifications';
import { creditAffiliatePoints } from '../flows/affiliatePoints';

// Chamado quando um novo usuário se registra
export async function handleNewUser(userId: number, userName: string) {
  await notifyAdmins('newUser', { userId, userName });
}

// Chamado quando um pagamento é aprovado
export async function handlePaymentApproved(paymentId: number, userId: number, amount: number, method: string) {
  await notifyAdmins('paymentApproved', { paymentId, userId, amount, method });
}

// Chamado quando uma venda é concluída
export async function handleSaleCompleted(orderId: number, userId: number, productName: string, total: number) {
  await notifyAdmins('saleCompleted', { orderId, userId, productName, total });
}

// Chamado quando um saque é solicitado
export async function handleWithdrawalRequested(withdrawalId: number, userId: number, amount: number) {
  await notifyAdmins('withdrawalRequested', { withdrawalId, userId, amount });
}

// Chamado quando o estoque está baixo
export async function handleLowStock(productId: number, productName: string, available: number) {
  await notifyAdmins('lowStock', { productId, productName, available });
}

// Chamado quando uma recarga de indicado é aprovada (para creditar pontos ao afiliado)
export async function handleAffiliateRecharge(referrerUserId: number, rechargeAmount: number) {
  await creditAffiliatePoints(referrerUserId, rechargeAmount);
}
