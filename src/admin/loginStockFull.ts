import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';
import { logAction } from '../services/logger';

// Painel de logins
export async function showLoginsPanel(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const count = await prisma.stockUnit.count({ where: { isSold: false } });
  await ctx.editMessage(`📦 LOGINS NO ESTOQUE: ${count}\n\nEscolha uma ação:`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: 'ADICIONAR LOGIN', callback_data: 'logins_add' }],
        [{ text: 'REMOVER LOGIN', callback_data: 'logins_remove' }],
        [{ text: 'REMOVER POR PLATAFORMA', callback_data: 'logins_remove_platform' }],
        [{ text: 'ESTOQUE DETALHADO', callback_data: 'logins_detailed' }],
        [{ text: 'ZERAR ESTOQUE', callback_data: 'logins_zero' }],
        [{ text: 'MUDAR VALOR DO SERVIÇO', callback_data: 'logins_change_price' }],
        [{ text: 'MUDAR VALOR DE TODOS', callback_data: 'logins_change_all_price' }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_config_logins' }],
      ],
    },
  });
}

// Adiciona logins em lote
export async function addLogins(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'logins_add', 'Envie os logins no formato:\nNOME===VALOR===DESCRICAO===EMAIL===SENHA===DURACAO\n\nSepare múltiplos logins por linha.', {
    validate: async (input) => input.trim().length > 0 ? null : 'Formato inválido.',
    onSuccess: async (ctx, text) => {
      const lines = text.split('\n').filter(l => l.trim());
      let created = 0;
      for (const line of lines) {
        const parts = line.split('===').map(s => s.trim());
        if (parts.length >= 6) {
          const [name, value, description, email, password, duration] = parts;
          let product = await prisma.product.findFirst({ where: { name } });
          if (!product) {
            product = await prisma.product.create({
              data: { name, price: parseFloat(value), description },
            });
          }
          await prisma.stockUnit.create({
            data: {
              productId: product.id,
              content: JSON.stringify({ email, password, description, duration }),
            },
          });
          created++;
        }
      }
      await ctx.editMessage(`✅ ${created} login(s) adicionado(s).`);
      await showLoginsPanel(ctx);
    },
  });
}

// Remove login específico
export async function removeLogin(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'logins_remove', 'Envie no formato SERVICO===EMAIL para remover:', {
    validate: async (input) => input.includes('===') ? null : 'Formato inválido.',
    onSuccess: async (ctx, text) => {
      const [service, email] = text.split('===').map(s => s.trim());
      const product = await prisma.product.findFirst({ where: { name: service } });
      if (!product) return ctx.editMessage('Serviço não encontrado.');
      const removed = await prisma.stockUnit.deleteMany({
        where: { productId: product.id, content: { contains: email } },
      });
      await ctx.editMessage(`✅ ${removed.count} login(s) removido(s).`);
      await showLoginsPanel(ctx);
    },
  });
}

// Remove por plataforma
export async function removeByPlatform(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'logins_remove_platform', 'Envie o nome da plataforma:', {
    validate: async (input) => input.trim() ? null : 'Nome inválido.',
    onSuccess: async (ctx, platform) => {
      const product = await prisma.product.findFirst({ where: { name: platform } });
      if (!product) return ctx.editMessage('Plataforma não encontrada.');
      await prisma.stockUnit.deleteMany({ where: { productId: product.id } });
      await ctx.editMessage(`✅ Todos os logins de ${platform} removidos.`);
      await showLoginsPanel(ctx);
    },
  });
}

// Zerar estoque
export async function zeroStock(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await prisma.stockUnit.deleteMany({ where: { isSold: false } });
  await ctx.editMessage('✅ Estoque zerado.');
  await showLoginsPanel(ctx);
}

// Estoque detalhado
export async function detailedStock(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const units = await prisma.stockUnit.findMany({
    where: { isSold: false },
    include: { product: true },
    take: 20,
  });
  const text = units.map(u => `${u.product.name} - ${u.content}`).join('\n') || 'Nenhum estoque.';
  await ctx.editMessage(`📋 Estoque detalhado:\n\n${text}`);
}

// Alterar preço de um serviço
export async function changeServicePrice(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'logins_change_price', 'Envie SERVICO===VALOR:', {
    validate: async (input) => input.includes('===') ? null : 'Formato inválido.',
    onSuccess: async (ctx, text) => {
      const [service, value] = text.split('===').map(s => s.trim());
      const product = await prisma.product.findFirst({ where: { name: service } });
      if (!product) return ctx.editMessage('Serviço não encontrado.');
      await prisma.product.update({ where: { id: product.id }, data: { price: parseFloat(value) } });
      await ctx.editMessage(`✅ Preço de ${service} alterado para R$ ${value}.`);
      await showLoginsPanel(ctx);
    },
  });
}

// Alterar preço de todos
export async function changeAllPrices(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'logins_change_all_price', 'Digite o novo valor para todos:', {
    validate: async (input) => {
      const num = parseFloat(input.replace(',', '.'));
      return isNaN(num) || num < 0 ? 'Valor inválido.' : null;
    },
    onSuccess: async (ctx, value) => {
      await prisma.product.updateMany({ data: { price: parseFloat(value) } });
      await ctx.editMessage(`✅ Todos os preços alterados para R$ ${value}.`);
      await showLoginsPanel(ctx);
    },
  });
}
