import nodemailer from 'nodemailer';
import config from '../config';
import prisma from '../database';
import { formatCurrency, formatDate, formatTime } from '../utils/format';

const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

interface PurchaseEmailData {
  to: string;
  orderId: number;
  productName: string;
  productEmoji?: string;
  price: number;
  quantity: number;
  total: number;
  paymentMethod: string;
  date: Date;
  validity?: string;
  description?: string;
  loginData?: string;
}

// Gera o link de ativação único
function generateActivationLink(orderId: number): string {
  return `${config.web.url}/web/ativar/${orderId}`;
}

export async function sendPurchaseEmail(data: PurchaseEmailData): Promise<boolean> {
  try {
    const template = await prisma.messageTemplate.findUnique({
      where: { key: 'email_compra' },
    });

    const activationLink = generateActivationLink(data.orderId);
    let subject = `Compra realizada - ${data.productName}`;
    let htmlBody = '';

    if (template) {
      const templateText = template.text
        .replace(/\{produto\}/g, data.productName)
        .replace(/\{valor\}/g, formatCurrency(data.total))
        .replace(/\{data\}/g, formatDate(data.date))
        .replace(/\{hora\}/g, formatTime(data.date))
        .replace(/\{pedido_id\}/g, String(data.orderId))
        .replace(/\{quantidade\}/g, String(data.quantity))
        .replace(/\{pagamento\}/g, data.paymentMethod)
        .replace(/\{validade\}/g, data.validity || '')
        .replace(/\{descricao\}/g, data.description || '')
        .replace(/\{login\}/g, data.loginData || '')
        .replace(/\{link_ativacao\}/g, activationLink);

      htmlBody = templateText.replace(/\n/g, '<br>');
    } else {
      htmlBody = `
        <h2>Compra realizada com sucesso!</h2>
        <p><strong>Produto:</strong> ${data.productName}</p>
        <p><strong>Valor:</strong> ${formatCurrency(data.total)}</p>
        <p><strong>Data:</strong> ${formatDate(data.date)} ${formatTime(data.date)}</p>
        <p><strong>Pedido ID:</strong> ${data.orderId}</p>
        ${data.validity ? `<p><strong>Vencimento:</strong> ${data.validity}</p>` : ''}
        <p><strong>Para acessar seu produto, clique no link abaixo e insira sua senha:</strong></p>
        <p><a href="${activationLink}" style="display:inline-block;padding:10px 20px;background:#6c5ce7;color:#fff;text-decoration:none;border-radius:5px;">Ativar Produto</a></p>
        <p>Ou copie e cole no navegador: ${activationLink}</p>
        <p>Obrigado por comprar conosco!</p>
      `;
    }

    const mailOptions = {
      from: config.smtp.from,
      to: data.to,
      subject,
      html: htmlBody,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`📧 E-mail enviado para ${data.to}: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error('❌ Erro ao enviar e-mail:', error);
    await prisma.log.create({
      data: {
        action: 'EMAIL_SEND_FAILED',
        details: { error: String(error), to: data.to, orderId: data.orderId },
      },
    });
    return false;
  }
}
