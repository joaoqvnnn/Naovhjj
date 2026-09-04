import nodemailer from 'nodemailer';
import config from '../config';
import prisma from '../database';
import { formatCurrency, formatDate, formatTime } from '../utils/format';

// Cria transporter com base nas configurações SMTP
const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465, // true se usar SSL
  auth: {
    user: config.smtp.user,
    pass: config.smtp.pass,
  },
});

// Interface para dados de compra
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
  loginData?: string; // conteúdo da unidade (login/senha)
}

// Função principal para enviar e-mail de entrega de compra
export async function sendPurchaseEmail(data: PurchaseEmailData): Promise<boolean> {
  try {
    // Busca template personalizado no banco (se existir)
    const template = await prisma.messageTemplate.findUnique({
      where: { key: 'email_compra' },
    });

    let subject = `Compra realizada - ${data.productName}`;
    let htmlBody = '';

    if (template) {
      // Substitui variáveis dinâmicas no texto do template
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
        .replace(/\{login\}/g, data.loginData || '');

      // Converte quebras de linha para <br> para HTML
      htmlBody = templateText.replace(/\n/g, '<br>');
      subject = `Compra realizada - ${data.productName}`; // poderia ser configurável
    } else {
      // Template padrão
      htmlBody = `
        <h2>Compra realizada com sucesso!</h2>
        <p><strong>Produto:</strong> ${data.productName}</p>
        <p><strong>Valor:</strong> ${formatCurrency(data.total)}</p>
        <p><strong>Data:</strong> ${formatDate(data.date)} ${formatTime(data.date)}</p>
        <p><strong>Pedido ID:</strong> ${data.orderId}</p>
        ${data.validity ? `<p><strong>Vencimento:</strong> ${data.validity}</p>` : ''}
        ${data.loginData ? `<p><strong>Dados de acesso:</strong> ${data.loginData}</p>` : ''}
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
    // Registra falha no log (pode ser usado para tentativas posteriores)
    await prisma.log.create({
      data: {
        action: 'EMAIL_SEND_FAILED',
        details: { error: String(error), to: data.to, orderId: data.orderId },
      },
    });
    return false;
  }
}

// Função para enviar código de recuperação de senha
export async function sendPasswordResetCode(to: string, code: string): Promise<boolean> {
  try {
    const mailOptions = {
      from: config.smtp.from,
      to,
      subject: 'Código de recuperação de senha',
      html: `<p>Seu código de recuperação é: <strong>${code}</strong></p><p>Válido por 10 minutos.</p>`,
    };
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Erro ao enviar código de recuperação:', error);
    return false;
  }
}
