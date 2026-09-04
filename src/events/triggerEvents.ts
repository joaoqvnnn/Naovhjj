import prisma from '../database';
import { notifyAdmins } from '../admin/notifications';

// Gatilhos de eventos
export async function triggerNewUser(userId: number, userName: string) {
  await notifyAdmins('newUser', `👤 Novo usuário cadastrado!\n\nID: ${userId}\nNome: ${userName}`);
}

export async function triggerPaymentApproved(paymentId: number, userId: number, amount: number, method: string) {
  await notifyAdmins('paymentApproved', `💰 Pagamento aprovado!\n\nPagamento: #${paymentId}\nUsuário: ${userId}\nValor: R$ ${amount.toFixed(2)}\nMétodo: ${method}`);
}

export async function triggerSaleCompleted(orderId: number, userId: number, productName: string, total: number) {
  await notifyAdmins('saleCompleted', `🛒 Venda realizada!\n\nPedido: #${orderId}\nUsuário: ${userId}\nProduto: ${productName}\nTotal: R$ ${total.toFixed(2)}`);
}

export async function triggerWithdrawalRequested(withdrawalId: number, userId: number, amount: number) {
  await notifyAdmins('withdrawalRequested', `💸 Saque solicitado!\n\nSaque: #${withdrawalId}\nUsuário: ${userId}\nValor: R$ ${amount.toFixed(2)}`);
}

export async function triggerLowStock(productId: number, productName: string, available: number) {
  await notifyAdmins('lowStock', `📦 Estoque baixo!\n\nProduto: ${productName} (#${productId})\nDisponíveis: ${available}`);
}

export async function triggerSuspiciousActivity(action: string, userId: number, details: string) {
  await notifyAdmins('suspiciousActivity', `⚠️ Atividade suspeita!\n\nAção: ${action}\nUsuário: ${userId}\nDetalhes: ${details}`);
}
