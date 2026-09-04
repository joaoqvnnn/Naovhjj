import { Context } from '../types/context';
import prisma from '../database';
import { formatCurrency } from '../utils/format';

// Tela principal de alertas
export async function showAlertsScreen(ctx: Context) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(userId) },
    include: { alertPreferences: { include: { product: true } } },
  });

  if (!user) {
    await ctx.editMessage('❌ Usuário não encontrado.');
    return;
  }

  // Busca todos os produtos ativos
  const allProducts = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
  });

  // Cria mapa de preferências do usuário
  const prefMap = new Map<number, boolean>();
  for (const pref of user.alertPreferences) {
    prefMap.set(pref.productId, pref.isActive);
  }

  let text = `🔔 Sistema de Alertas\n\n` +
    `Seja notificado quando seu serviço favorito for abastecido.\n\n` +
    `Toque para ativar/desativar:\n\n`;

  const buttons = [];
  for (const product of allProducts) {
    const isActive = prefMap.get(product.id) || false;
    text += `${isActive ? '✅' : '❌'} ${product.emoji || ''} ${product.name}\n`;
    buttons.push([{
      text: `${isActive ? '✅' : '❌'} ${product.name}`,
      callback_data: `alert_toggle_${product.id}`,
    }]);
  }

  buttons.push([{ text: '⏮️ Voltar', callback_data: 'voltar' }]);

  await ctx.editMessage(text, {
    reply_markup: { inline_keyboard: buttons },
  });
}

// Toggle de alerta para um produto
export async function toggleAlert(ctx: Context, productId: number) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(userId) },
  });

  if (!user) return;

  // Verifica se já existe preferência
  const existing = await prisma.alertPreference.findUnique({
    where: { userId_productId: { userId: user.id, productId } },
  });

  if (existing) {
    // Alterna estado
    await prisma.alertPreference.update({
      where: { id: existing.id },
      data: { isActive: !existing.isActive },
    });
  } else {
    // Cria nova preferência ativa
    await prisma.alertPreference.create({
      data: {
        userId: user.id,
        productId,
        isActive: true,
      },
    });
  }

  // Re-renderiza a tela de alertas
  await showAlertsScreen(ctx);
}

// Função para notificar usuários quando um produto é reabastecido
export async function notifyStockAlert(productId: number, productName: string, available: number) {
  // Busca preferências ativas para o produto
  const prefs = await prisma.alertPreference.findMany({
    where: {
      productId,
      isActive: true,
    },
    include: { user: true },
  });

  const message = `🔔 Alerta de Estoque!\n\n` +
    `O produto ${productName} foi reabastecido.\n` +
    `📦 Unidades disponíveis: ${available}\n\n` +
    `Clique abaixo para comprar:`;

  for (const pref of prefs) {
    try {
      // Envia mensagem via bot (usando Telegram Bot API)
      // O bot pode ser importado de bot.ts, mas evitamos dependência circular
      // Aqui assumimos que temos acesso ao bot
      const { default: bot } = await import('../bot');
      await bot.telegram.sendMessage(pref.user.telegramId.toString(), message, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🛒 Comprar', callback_data: `comprar_${productId}` }],
          ],
        },
      });
    } catch (error) {
      console.error(`Erro ao notificar usuário ${pref.user.telegramId}:`, error);
    }
  }
}
