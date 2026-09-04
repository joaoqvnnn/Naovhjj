import prisma from '../database';
import { notifyAdmins } from './notifications';

// Função chamada quando um novo usuário se cadastra
export async function triggerNewUserNotification(userId: number, userName: string) {
  await notifyAdmins('newUser', `👤 Novo usuário cadastrado!\n\nID: ${userId}\nNome: ${userName}`);
}

// Função chamada quando um pagamento é aprovado
export async function triggerPaymentApproved(paymentId: number, userId: number, amount: number, method: string) {
  await notifyAdmins('paymentApproved', `💰 Pagamento aprovado!\n\nPagamento: #${paymentId}\nUsuário: ${userId}\nValor: R$ ${amount.toFixed(2)}\nMétodo: ${method}`);
}

// Função chamada quando uma venda é concluída
export async function triggerSaleCompleted(orderId: number, userId: number, productName: string, total: number) {
  await notifyAdmins('saleCompleted', `🛒 Venda realizada!\n\nPedido: #${orderId}\nUsuário: ${userId}\nProduto: ${productName}\nTotal: R$ ${total.toFixed(2)}`);
}

// Função chamada quando um saque é solicitado
export async function triggerWithdrawalRequested(withdrawalId: number, userId: number, amount: number) {
  await notifyAdmins('withdrawalRequested', `💸 Saque solicitado!\n\nSaque: #${withdrawalId}\nUsuário: ${userId}\nValor: R$ ${amount.toFixed(2)}`);
}

// Função chamada quando o estoque de um produto está baixo
export async function triggerLowStock(productId: number, productName: string, available: number) {
  await notifyAdmins('lowStock', `📦 Estoque baixo!\n\nProduto: ${productName} (#${productId})\nDisponíveis: ${available}`);
}
