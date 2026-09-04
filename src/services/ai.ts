// Serviço de IA para interpretação de intenções (baseado em regras)
// Pode ser substituído por uma API externa (ex: OpenAI) mantendo a mesma interface.

export type Intent =
  | 'HISTORICO'
  | 'COMPRAS_ATIVAS'
  | 'SALDO'
  | 'SACAR'
  | 'SALDO_AFILIADO'
  | 'RANKING'
  | 'ALERTA'
  | 'GIFT_CARD'
  | 'SUPORTE'
  | 'INICIO'
  | 'DESCONHECIDO';

export interface AIResponse {
  intent: Intent;
  message?: string; // resposta amigável opcional
}

// Função principal: interpreta a mensagem do usuário e retorna a intenção
export function interpretMessage(text: string): AIResponse {
  const msg = text.toLowerCase().trim();

  // Histórico de compras
  if (/(historico|compras|pedidos)/.test(msg)) {
    if (/(ativo|ativa|vigente|nao vencido)/.test(msg)) {
      return { intent: 'COMPRAS_ATIVAS', message: 'Vou buscar suas compras ativas.' };
    }
    return { intent: 'HISTORICO', message: 'Abrindo seu histórico de compras.' };
  }

  // Saldo da carteira
  if (/(saldo|carteira|quanto tenho)/.test(msg)) {
    return { intent: 'SALDO', message: 'Consultando seu saldo.' };
  }

  // Saque de afiliado
  if (/(sacar|saque|retirar|levantar)/.test(msg)) {
    return { intent: 'SACAR', message: 'Vamos ao saque.' };
  }

  // Saldo de afiliado
  if (/(afiliado|comissao|ganhos)/.test(msg)) {
    return { intent: 'SALDO_AFILIADO', message: 'Verificando seus ganhos de afiliado.' };
  }

  // Ranking
  if (/(ranking|top|mais vendidos)/.test(msg)) {
    return { intent: 'RANKING', message: 'Abrindo os rankings.' };
  }

  // Alerta de estoque
  if (/(alerta|notificar|aviso|estoque)/.test(msg)) {
    return { intent: 'ALERTA', message: 'Configurando alertas de estoque.' };
  }

  // Gift Card
  if (/(gift|vale|codigo de presente|resgatar)/.test(msg)) {
    return { intent: 'GIFT_CARD', message: 'Vamos resgatar um Gift Card.' };
  }

  // Suporte
  if (/(suporte|ajuda|contato|atendimento)/.test(msg)) {
    return { intent: 'SUPORTE', message: 'Informações de suporte.' };
  }

  // Início
  if (/(inicio|menu|comecar|start)/.test(msg)) {
    return { intent: 'INICIO', message: 'Voltando ao menu principal.' };
  }

  return { intent: 'DESCONHECIDO', message: 'Desculpe, não entendi. Use os botões do menu.' };
}
