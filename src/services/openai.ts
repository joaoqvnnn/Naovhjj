import axios from 'axios';
import prisma from '../database';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

export async function generateAIResponse(userId: number, userMessage: string): Promise<string> {
  if (!OPENAI_API_KEY) {
    return '⚠️ IA não configurada. Tente falar com um humano.';
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      orders: { orderBy: { createdAt: 'desc' }, take: 5 },
      withdrawals: { orderBy: { createdAt: 'desc' }, take: 3 },
    },
  });

  if (!user) return 'Usuário não encontrado.';

  const saldo = parseFloat(user.balance.toString()).toFixed(2);
  const totalCompras = user.orders.length;
  const totalGasto = user.orders.reduce((acc, o) => acc + parseFloat(o.totalPrice.toString()), 0).toFixed(2);
  const ultimasCompras = user.orders.map(o => `- ${o.product.name} (R$ ${o.totalPrice})`).join('\n') || 'Nenhuma compra recente.';
  const saldoAfiliado = parseFloat(user.affiliateBalance.toString()).toFixed(2);

  const systemPrompt = `Você é o assistente virtual da Larizinha Store.
Usuário: ${user.username || user.firstName} (ID: ${user.id})
Saldo: R$ ${saldo}
Total de compras: ${totalCompras}
Total gasto: R$ ${totalGasto}
Saldo afiliado: R$ ${saldoAfiliado}
Últimas compras:
${ultimasCompras}

Regras:
- Responda com base nos dados fornecidos.
- Se não souber, diga que não tem essa informação.
- Se o usuário pedir para falar com humano, oriente a usar o botão "Falar com humano".
- Seja educado e objetivo.`;

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
    return '⚠️ Estou com dificuldades para responder agora. Tente novamente mais tarde.';
  }
}
