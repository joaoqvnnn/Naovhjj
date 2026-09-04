import { Context } from '../types/context';
import prisma from '../database';

const ITEMS_PER_PAGE = 5; // quantos produtos por página

// Mostra a tela de alertas com paginação
export async function showAlertsScreen(ctx: Context, page: number = 0) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({
    where: { telegramId: BigInt(userId) },
    include: { alertPreferences: { include: { product: true } } },
  });

  if (!user) return ctx.editMessage('Usuário não encontrado.');

  // Busca todos os produtos ativos, ordenados
  const allProducts = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
  });

  const totalPages = Math.ceil(allProducts.length / ITEMS_PER_PAGE);
  if (page < 0) page = 0;
  if (page >= totalPages) page = totalPages - 1;

  const start = page * ITEMS_PER_PAGE;
  const end = Math.min(start + ITEMS_PER_PAGE, allProducts.length);
  const pageProducts = allProducts.slice(start, end);

  // Mapa de preferências do usuário
  const prefMap = new Map<number, boolean>();
  for (const pref of user.alertPreferences) {
    prefMap.set(pref.productId, pref.isActive);
  }

  let text = `🔔 Sistema de Alertas\n\n` +
    `Seja notificado quando seu serviço favorito for abastecido 🤩\n` +
    `Basta selecionar abaixo os serviços que você deseja ser notificado.\n\n` +
    `Página ${page + 1} de ${totalPages || 1}\n\n` +
    `Lista de serviços ⤵️\n\n`;

  const inlineKeyboard = [];

  // Botões para cada produto da página
  for (const product of pageProducts) {
    const isActive = prefMap.get(product.id) || false;
    text += `${isActive ? '✅' : '❌'} ${product.emoji || ''} ${product.name}\n`;
    inlineKeyboard.push([{
      text: `${isActive ? '✅' : '❌'} ${product.name}`,
      callback_data: `alert_toggle_${product.id}`,
    }]);
  }

  // Botões de navegação (se houver mais de uma página)
  const navButtons = [];
  if (page > 0) {
    navButtons.push({ text: '⬅️ Anterior', callback_data: `alerts_page_${page - 1}` });
  }
  if (page < totalPages - 1) {
    navButtons.push({ text: 'Próxima ➡️', callback_data: `alerts_page_${page + 1}` });
  }
  if (navButtons.length > 0) {
    inlineKeyboard.push(navButtons);
  }

  // Botão voltar
  inlineKeyboard.push([{ text: '⏮️ Voltar', callback_data: 'voltar_inicio' }]);

  // Edita a mensagem atual ou envia nova
  if (ctx.session.messageIdToEdit && ctx.session.chatId) {
    await ctx.telegram.editMessageText(
      ctx.session.chatId,
      ctx.session.messageIdToEdit,
      undefined,
      text,
      { reply_markup: { inline_keyboard: inlineKeyboard } }
    );
  } else {
    const sent = await ctx.reply(text, {
      reply_markup: { inline_keyboard: inlineKeyboard },
    });
    if (sent.message_id) {
      ctx.session.messageIdToEdit = sent.message_id;
      ctx.session.chatId = ctx.chat!.id;
    }
  }
}

// Alterna o alerta de um produto e re-renderiza a tela (na mesma página)
export async function toggleAlert(ctx: Context, productId: number) {
  const userId = ctx.from!.id;
  const user = await prisma.user.findUnique({ where: { telegramId: BigInt(userId) } });

  if (!user) return;

  const existing = await prisma.alertPreference.findUnique({
    where: { userId_productId: { userId: user.id, productId } },
  });

  if (existing) {
    await prisma.alertPreference.update({
      where: { id: existing.id },
      data: { isActive: !existing.isActive },
    });
  } else {
    await prisma.alertPreference.create({
      data: { userId: user.id, productId, isActive: true },
    });
  }

  // Re-renderiza a página atual (assumindo que a página atual está salva na sessão ou volta para 0)
  // Aqui, por simplicidade, usamos a página 0, mas você pode salvar a página na sessão.
  // Para melhor UX, armazenamos a página atual em ctx.session.data.alertPage.
  const currentPage = ctx.session.data?.alertPage || 0;
  await showAlertsScreen(ctx, currentPage);
}
