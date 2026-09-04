import axios from 'axios';
import config from '../config';
import prisma from '../database';
import { PaymentStatus } from '@prisma/client';

// Interface para resposta de pagamento
interface MercadoPagoPaymentResponse {
  id: number;
  status: string;
  status_detail: string;
  point_of_interaction?: {
    transaction_data?: {
      qr_code?: string;
      qr_code_base64?: string;
      ticket_url?: string;
    };
  };
}

export class MercadoPagoService {
  private accessToken: string;
  private apiBase = 'https://api.mercadopago.com/v1';

  constructor() {
    this.accessToken = config.mpAccessToken;
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  // Cria uma cobrança Pix
  async createPixPayment(amount: number, description: string, referenceId: string): Promise<{
    id: number;
    qrCode: string;
    qrCodeImage: string;
    expiresAt: Date;
  }> {
    try {
      const response = await axios.post(
        `${this.apiBase}/payments`,
        {
          transaction_amount: amount,
          description,
          payment_method_id: 'pix',
          payer: {
            email: 'cliente@exemplo.com', // pode ser configurável
          },
          notification_url: `${config.web.url}/web/webhook/mercadopago`,
          external_reference: referenceId,
        },
        { headers: this.getHeaders() }
      );

      const data: MercadoPagoPaymentResponse = response.data;
      const qrCode = data.point_of_interaction?.transaction_data?.qr_code || '';
      const qrCodeImage = data.point_of_interaction?.transaction_data?.ticket_url || '';
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos padrão

      return {
        id: data.id,
        qrCode,
        qrCodeImage,
        expiresAt,
      };
    } catch (error: any) {
      console.error('Erro ao criar pagamento Pix:', error.response?.data || error.message);
      throw new Error('Falha ao gerar Pix. Tente novamente.');
    }
  }

  // Consulta status de um pagamento
  async getPaymentStatus(paymentId: number): Promise<PaymentStatus> {
    try {
      const response = await axios.get(`${this.apiBase}/payments/${paymentId}`, {
        headers: this.getHeaders(),
      });
      const data = response.data;
      return this.mapStatus(data.status);
    } catch (error: any) {
      console.error('Erro ao consultar pagamento:', error.response?.data || error.message);
      throw new Error('Falha ao consultar status do pagamento.');
    }
  }

  private mapStatus(status: string): PaymentStatus {
    switch (status) {
      case 'approved':
        return 'APPROVED';
      case 'pending':
        return 'PENDING';
      case 'in_process':
        return 'PENDING';
      case 'rejected':
        return 'CANCELLED';
      case 'cancelled':
        return 'CANCELLED';
      case 'refunded':
        return 'REFUNDED';
      case 'charged_back':
        return 'REFUNDED';
      default:
        return 'PENDING';
    }
  }

  // Verifica assinatura do webhook (simples, deve ser aprimorada em produção)
  verifyWebhookSignature(req: any): boolean {
    // Implementar verificação com cabeçalhos ou segredo
    // Por enquanto, retorna true
    return true;
  }
}

// Instância única
export const mercadopago = new MercadoPagoService();
