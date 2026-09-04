import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from '../admin/userManagement';
import { formatCurrency, formatDateTime } from '../utils/format';
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

// Gera PDF com histórico do usuário e envia no chat
export async function generateUserHistoryPdf(ctx: Context, userId: number) {
  if (!(await isAdmin(ctx))) return;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      orders: { orderBy: { createdAt: 'asc' }, include: { product: true } },
      withdrawals: { orderBy: { createdAt: 'asc' } },
    },
  });

  if (!user) return ctx.editMessage('Usuário não encontrado.');

  // Cria documento PDF
  const doc = new PDFDocument({ margin: 50 });
  const buffers: Buffer[] = [];
  doc.on('data', (chunk) => buffers.push(chunk));
  doc.on('end', async () => {
    const pdfBuffer = Buffer.concat(buffers);

    // Envia como documento
    const bot = (await import('../bot')).default;
    await bot.telegram.sendDocument(user.telegramId.toString(), {
      source: pdfBuffer,
      filename: `historico_${user.id}.pdf`,
    });
  });

  // Cabeçalho
  doc.fontSize(20).text('Histórico do Usuário', { align: 'center' });
  doc.moveDown();
  doc.fontSize(12).text(`Nome: ${user.firstName || 'N/A'} ${user.lastName || ''}`);
  doc.text(`Telegram ID: ${user.telegramId}`);
  doc.text(`Username: @${user.username || 'N/A'}`);
  doc.text(`Saldo atual: ${formatCurrency(user.balance)}`);
  doc.text(`Saldo afiliado: ${formatCurrency(user.affiliateBalance)}`);
  doc.moveDown();

  // Histórico de compras
  doc.fontSize(14).text('Compras', { underline: true });
  doc.moveDown(0.5);
  if (user.orders.length === 0) {
    doc.text('Nenhuma compra registrada.');
  } else {
    for (const order of user.orders) {
      doc.fontSize(10).text(`#${order.id} - ${order.product.name}`);
      doc.text(`Data: ${formatDateTime(order.createdAt)}`);
      doc.text(`Valor: ${formatCurrency(order.totalPrice)}`);
      doc.text(`Status: ${order.status}`);
      doc.moveDown(0.5);
    }
  }

  // Histórico de saques
  doc.moveDown();
  doc.fontSize(14).text('Saques', { underline: true });
  doc.moveDown(0.5);
  if (user.withdrawals.length === 0) {
    doc.text('Nenhum saque solicitado.');
  } else {
    for (const w of user.withdrawals) {
      doc.fontSize(10).text(`#${w.id} - ${w.method}`);
      doc.text(`Valor: ${formatCurrency(w.amount)}`);
      doc.text(`Status: ${w.status}`);
      doc.text(`Data: ${formatDateTime(w.createdAt)}`);
      doc.moveDown(0.5);
    }
  }

  doc.end();

  await ctx.answerCbQuery('PDF gerado e enviado para o usuário.');
}
