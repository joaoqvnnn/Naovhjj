import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';
import { generateRandomCode } from '../utils/format';

export async function showGiftCardAdminMenu(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const totalActive = await prisma.giftCard.count({ where: { status: 'ACTIVE' } });
  const totalUsed = await prisma.giftCard.count({ where: { status: 'USED' } });

  await ctx.editMessage(`🎁 Gift Cards\n\nAtivos: ${totalActive}\nUtilizados: ${totalUsed}\n\nEscolha:`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '➕ Criar Gift Card', callback_data: 'giftcard_admin_create' }],
        [{ text: '📋 Listar', callback_data: 'giftcard_admin_list' }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_menu_actions' }],
      ],
    },
  });
}

export async function createGiftCard(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  await startCapture(ctx, 'giftcard_create_value', 'Digite o valor do Gift Card (ex: 10.00):', {
    validate: async (input) => {
      const num = parseFloat(input.replace(',', '.'));
      return isNaN(num) || num <= 0 ? 'Valor inválido.' : null;
    },
    onSuccess: async (ctx, value) => {
      const valor = parseFloat(value.replace(',', '.'));

      await startCapture(ctx, 'giftcard_create_days', 'Digite a validade em dias (ex: 30):', {
        validate: async (input) => {
          const num = parseInt(input);
          return isNaN(num) || num <= 0 ? 'Valor inválido.' : null;
        },
        onSuccess: async (ctx, days) => {
          const code = generateRandomCode(12).toUpperCase();
          const expiresAt = new Date(Date.now() + parseInt(days) * 24 * 60 * 60 * 1000);

          await prisma.giftCard.create({ data: { code, value: valor, expiresAt, status: 'ACTIVE' } });

          await ctx.editMessage(`✅ Gift Card criado!\n\nCódigo: <code>${code}</code>\nValor: R$ ${valor.toFixed(2)}\nValidade: ${days} dias`, {
            parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'giftcard_admin_menu' }]] },
          });
        },
      });
    },
  });
}

export async function createGiftCardBatch(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  await startCapture(ctx, 'giftcard_batch', 'Envie no formato: VALOR===DIAS===QUANTIDADE\nEx: 10===30===5', {
    validate: async (input) => {
      const parts = input.split('===').map(s => s.trim());
      if (parts.length !== 3) return 'Formato inválido.';
      const [valor, dias, qtd] = parts.map(Number);
      if (isNaN(valor) || isNaN(dias) || isNaN(qtd) || valor <= 0 || dias <= 0 || qtd <= 0) return 'Valores inválidos.';
      return null;
    },
    onSuccess: async (ctx, input) => {
      const [valorStr, diasStr, qtdStr] = input.split('===').map(s => s.trim());
      const valor = parseFloat(valorStr.replace(',', '.'));
      const dias = parseInt(diasStr);
      const quantidade = parseInt(qtdStr);
      const expiresAt = new Date(Date.now() + dias * 24 * 60 * 60 * 1000);

      const codes = [];
      for (let i = 0; i < quantidade; i++) {
        const code = generateRandomCode(12).toUpperCase();
        codes.push(code);
        await prisma.giftCard.create({ data: { code, value: valor, expiresAt, status: 'ACTIVE' } });
      }

      await ctx.editMessage(`✅ ${quantidade} Gift Cards criados!\n\nCódigos:\n<code>${codes.join('\n')}</code>`, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'giftcard_admin_menu' }]] },
      });
    },
  });
}

export async function listGiftCards(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const giftCards = await prisma.giftCard.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  if (!giftCards.length) {
    await ctx.editMessage('Nenhum Gift Card.', {
      reply_markup: { inline_keyboard: [[{ text: '⏮️ Voltar', callback_data: 'giftcard_admin_menu' }]] },
    });
    return;
  }

  const text = giftCards.map(g => `#${g.id} - ${g.code} - R$ ${g.value} - ${g.status}`).join('\n');
  const buttons = giftCards.map(g => [{ text: `🔍 ${g.code}`, callback_data: `giftcard_admin_view_${g.id}` }]);
  buttons.push([{ text: '⏮️ Voltar', callback_data: 'giftcard_admin_menu' }]);

  await ctx.editMessage(`🎁 Gift Cards\n\n${text}`, { reply_markup: { inline_keyboard: buttons } });
}

export async function viewGiftCard(ctx: Context, giftCardId: number) {
  if (!(await isAdmin(ctx))) return;

  const giftCard = await prisma.giftCard.findUnique({ where: { id: giftCardId } });
  if (!giftCard) return ctx.editMessage('Gift Card não encontrado.');

  const text = `🎁 Gift Card #${giftCard.id}\n\n` +
    `Código: ${giftCard.code}\n` +
    `Valor: R$ ${giftCard.value}\n` +
    `Status: ${giftCard.status}\n` +
    `Validade: ${giftCard.expiresAt?.toLocaleDateString('pt-BR') || 'Sem validade'}\n` +
    `Usado em: ${giftCard.usedAt?.toLocaleDateString('pt-BR') || 'N/A'}`;

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '❌ Desativar', callback_data: `giftcard_admin_disable_${giftCard.id}` }],
        [{ text: '🗑️ Excluir', callback_data: `giftcard_admin_delete_${giftCard.id}` }],
        [{ text: '⏮️ Voltar', callback_data: 'giftcard_admin_list' }],
      ],
    },
  });
}

export async function disableGiftCard(ctx: Context, giftCardId: number) {
  if (!(await isAdmin(ctx))) return;
  await prisma.giftCard.update({ where: { id: giftCardId }, data: { status: 'DISABLED' } });
  await ctx.editMessage('✅ Gift Card desativado.');
  await viewGiftCard(ctx, giftCardId);
}

export async function deleteGiftCard(ctx: Context, giftCardId: number) {
  if (!(await isAdmin(ctx))) return;
  await prisma.giftCard.delete({ where: { id: giftCardId } });
  await ctx.editMessage('✅ Gift Card excluído.');
  await listGiftCards(ctx);
}
