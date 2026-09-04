import prisma from '../database';
import { notifyAdmins } from '../services/adminNotifications';
import { creditAffiliatePoints } from '../flows/affiliatePoints';

// Novo usuário
export async function handleNewUser(userId: number, userName: string) {
  await notifyAdmins('newUser', { userId, userName });
}

// Pagamento aprovado
export async function handlePaymentApproved(paymentId: number, userId: number, amount: number, method: string) {
  await notifyAdmins('paymentApproved', { paymentId, userId, amount, method });
}

// Venda concluída
export async function handleSaleCompleted(orderId: number, userId: number, productName: string, total: number) {
  await notifyAdmins('saleCompleted', { orderId, userId, productName, total });
}

// Saque solicitado
export async function handleWithdrawalRequested(withdrawalId: number, userId: number, amount: number) {
  await notifyAdmins('withdrawalRequested', { withdrawalId, userId, amount });
}

// Estoque baixo
export async function handleLowStock(productId: number, productName: string, available: number) {
  await notifyAdmins('lowStock', { productId, productName, available });
}

// Recarga de indicado (para creditar pontos ao afiliado)
export async function handleAffiliateRecharge(referrerUserId: number, rechargeAmount: number) {
  await creditAffiliatePoints(referrerUserId, rechargeAmount);
}

// Atividade suspeita
export async function handleSuspiciousActivity(action: string, userId: number, details: string) {
  await notifyAdmins('suspiciousActivity', { action, userId, details });
}
