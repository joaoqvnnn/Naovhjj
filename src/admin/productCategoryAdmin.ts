import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';
import { logAction } from '../services/logger';

// ========== PRODUTOS ==========

// Lista produtos
export async function listProducts(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const products = await prisma.product.findMany({ orderBy: { id: 'desc' }, take: 10 });
  const text = products.map(p => `#${p.id} - ${p.name} - R$ ${p.price}`).join('\n') || 'Nenhum produto.';
  await ctx.editMessage(`📦 Produtos:\n\n${text}`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '➕ Novo produto', callback_data: 'prod_new' }],
        [{ text: '✏️ Editar produto', callback_data: 'prod_edit' }],
        [{ text: '🗂 Categorias', callback_data: 'cat_menu' }],
        [{ text: '⏮️ Voltar', callback_data: 'admin_dashboard' }],
      ],
    },
  });
}

// Cria novo produto
export async function createProduct(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'prod_new_name', 'Digite o nome do produto:', {
    validate: async (input) => input.length > 0 ? null : 'Nome inválido.',
    onSuccess: async (ctx, name) => {
      await startCapture(ctx, 'prod_new_price', `Produto: ${name}\nDigite o preço:`, {
        validate: async (input) => {
          const num = parseFloat(input.replace(',', '.'));
          return isNaN(num) || num <= 0 ? 'Preço inválido.' : null;
        },
        onSuccess: async (ctx, price) => {
          const product = await prisma.product.create({
            data: {
              name,
              price: parseFloat(price.replace(',', '.')),
              isActive: true,
            },
          });
          await logAction({ action: 'PRODUCT_CREATED', details: { productId: product.id, name, price } });
          await ctx.editMessage(`✅ Produto "${name}" criado com sucesso! ID: ${product.id}`);
        },
      });
    },
  });
}

// Edita produto (exemplo simplificado: nome e preço)
export async function editProduct(ctx: Context, productId: number) {
  if (!(await isAdmin(ctx))) return;
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return ctx.editMessage('Produto não encontrado.');

  await ctx.editMessage(`Editando produto #${product.id}\nSelecione o campo:`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📝 Nome', callback_data: `prod_edit_name_${product.id}` }],
        [{ text: '💰 Preço', callback_data: `prod_edit_price_${product.id}` }],
        [{ text: '✅ Ativar/Desativar', callback_data: `prod_toggle_${product.id}` }],
        [{ text: '🔙 Voltar', callback_data: 'prod_list' }],
      ],
    },
  });
}

// Altera nome
export async function editProductName(ctx: Context, productId: number) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, `prod_edit_name_${productId}`, 'Digite o novo nome:', {
    validate: async (input) => input.length > 0 ? null : 'Nome inválido.',
    onSuccess: async (ctx, name) => {
      await prisma.product.update({ where: { id: productId }, data: { name } });
      await logAction({ action: 'PRODUCT_NAME_UPDATED', details: { productId, name } });
      await ctx.editMessage('✅ Nome atualizado.');
    },
  });
}

// Altera preço
export async function editProductPrice(ctx: Context, productId: number) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, `prod_edit_price_${productId}`, 'Digite o novo preço:', {
    validate: async (input) => {
      const num = parseFloat(input.replace(',', '.'));
      return isNaN(num) || num <= 0 ? 'Preço inválido.' : null;
    },
    onSuccess: async (ctx, price) => {
      const newPrice = parseFloat(price.replace(',', '.'));
      await prisma.product.update({ where: { id: productId }, data: { price: newPrice } });
      await logAction({ action: 'PRODUCT_PRICE_UPDATED', details: { productId, newPrice } });
      await ctx.editMessage('✅ Preço atualizado.');
    },
  });
}

// Ativa/desativa produto
export async function toggleProduct(ctx: Context, productId: number) {
  if (!(await isAdmin(ctx))) return;
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return ctx.editMessage('Produto não encontrado.');
  await prisma.product.update({ where: { id: productId }, data: { isActive: !product.isActive } });
  await logAction({ action: 'PRODUCT_TOGGLED', details: { productId, isActive: !product.isActive } });
  await ctx.editMessage(`✅ Produto ${!product.isActive ? 'ativado' : 'desativado'}.`);
}

// ========== CATEGORIAS ==========

// Lista categorias
export async function listCategories(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const categories = await prisma.category.findMany({ orderBy: { order: 'asc' } });
  const text = categories.map(c => `#${c.id} - ${c.name}`).join('\n') || 'Nenhuma categoria.';
  await ctx.editMessage(`🗂 Categorias:\n\n${text}`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '➕ Nova categoria', callback_data: 'cat_new' }],
        [{ text: '⏮️ Voltar', callback_data: 'prod_list' }],
      ],
    },
  });
}

// Cria categoria
export async function createCategory(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'cat_new_name', 'Digite o nome da categoria:', {
    validate: async (input) => input.length > 0 ? null : 'Nome inválido.',
    onSuccess: async (ctx, name) => {
      await prisma.category.create({ data: { name } });
      await logAction({ action: 'CATEGORY_CREATED', details: { name } });
      await ctx.editMessage(`✅ Categoria "${name}" criada.`);
    },
  });
}

// Edita categoria (nome)
export async function editCategory(ctx: Context, categoryId: number) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, `cat_edit_name_${categoryId}`, 'Digite o novo nome:', {
    validate: async (input) => input.length > 0 ? null : 'Nome inválido.',
    onSuccess: async (ctx, name) => {
      await prisma.category.update({ where: { id: categoryId }, data: { name } });
      await logAction({ action: 'CATEGORY_NAME_UPDATED', details: { categoryId, name } });
      await ctx.editMessage('✅ Categoria atualizada.');
    },
  });
}
