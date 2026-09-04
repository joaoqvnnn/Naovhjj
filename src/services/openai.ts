import axios from 'axios';
import prisma from '../database';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = 'gpt-4o-mini'; // ou outro modelo disponível

// Gera resposta da IA com contexto do usuário
export async function generateAIResponse(userId: number, userMessage: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    return '⚠️ IA não configurada. Tente falar com um humano.';
  }

  // Busca dados do usuário para contextualizar
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      orders: { orderBy: { createdAt: 'desc' }, take: 5 },
      withdrawals: { orderBy: { createdAt: 'desc' }, take: 3 },
    },
  });

  if (!user) return 'Usuário não encontrado.';

  // Monta resumo do histórico
  const saldo = parseFloat(user.balance.toString()).toFixed(2);
  const totalCompras = user.orders.length;
  const totalGasto = user.orders.reduce((acc, o) => acc + parseFloat(o.totalPrice.toString()), 0).toFixed(2);
  const ultimasCompras = user.orders.map(o => `- ${o.product.name} (R$ ${o.totalPrice})`).join('\n') || 'Nenhuma compra recente.';
  const saldoAfiliado = parseFloat(user.affiliateBalance.toString()).toFixed(2);

  const systemPrompt = `Você é o assistente virtual da Larizinha Store, uma loja de produtos digitais (streaming, contas, etc) no Telegram.
Você atende o usuário ${user.username || user.firstName} (ID interno: ${user.id}).
Dados atuais do usuário:
- Saldo na carteira: R$ ${saldo}
- Total de compras: ${totalCompras}
- Total gasto: R$ ${totalGasto}
- Saldo de afiliado: R$ ${saldoAfiliado}
- Últimas compras:
${ultimasCompras}

Regras:
- Responda de forma amigável e útil.
- Se o usuário perguntar sobre saldo, compras, histórico, use os dados fornecidos.
- Se ele pedir para falar com um humano, oriente a clicar no botão "Falar com humano".
- Não invente informações. Se não souber, diga que não tem essa informação.
- Mantenha respostas curtas e diretas.`;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.5,
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Erro ao chamar OpenAI:', error);
    return '⚠️ Estou com dificuldades para responder agora. Tente novamente mais tarde ou fale com um humano.';
  }
}
