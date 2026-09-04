import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';
import { logAction } from '../services/logger';
import { formatCurrency } from '../utils/format';

// ========== PRODUTOS ==========

// Lista produtos
export async function listProducts(ctx: Context, page: number = 0) {
  if (!(await isAdmin(ctx))) return;

  const perPage = 10;
  const total = await prisma.product.count();
  const products = await prisma.product.findMany({
    orderBy: { id: 'desc' },
    skip: page * perPage,
    take: perPage,
  });

  const totalPages = Math.ceil(total / perPage) || 1;
  let text = `📦 PRODUTOS (página ${page + 1}/${totalPages})\n\n`;
  products.forEach(p => {
    text += `#${p.id} - ${p.name} - ${formatCurrency(p.price)} - ${p.isActive ? 'Ativo' : 'Inativo'}\n`;
  });

  const buttons = [];
  const navButtons = [];
  if (page > 0) navButtons.push({ text: '⬅️ Anterior', callback_data: `products_page_${page - 1}` });
  if (page < totalPages - 1) navButtons.push({ text: 'Próxima ➡️', callback_data: `products_page_${page + 1}` });
  if (navButtons.length) buttons.push(navButtons);

  buttons.push([{ text: '➕ Novo produto', callback_data: 'prod_new' }]);
  buttons.push([{ text: '🗂 Categorias', callback_data: 'cat_menu' }]);
  buttons.push([{ text: '⏮️ Voltar', callback_data: 'admin_menu_config' }]);

  await ctx.editMessage(text, {
    reply_markup: { inline_keyboard: buttons },
  });
}

// Cria novo produto
export async function createProduct(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  await startCapture(ctx, 'prod_new_name', 'Digite o nome do produto:', {
    validate: async (input) => input.trim().length > 0 ? null : 'Nome inválido.',
    onSuccess: async (ctx, name) => {
      ctx.session.data = { ...ctx.session.data, productName: name };

      await startCapture(ctx, 'prod_new_price', 'Digite o preço do produto:', {
        validate: async (input) => {
          const num = parseFloat(input.replace(',', '.'));
          return isNaN(num) || num <= 0 ? 'Preço inválido.' : null;
        },
        onSuccess: async (ctx, price) => {
          ctx.session.data = { ...ctx.session.data, productPrice: parseFloat(price.replace(',', '.')) };

          await startCapture(ctx, 'prod_new_desc', 'Digite a descrição (ou envie "-" para pular):', {
            validate: async () => null,
            onSuccess: async (ctx, desc) => {
              const description = desc.trim() === '-' ? '' : desc;
              ctx.session.data = { ...ctx.session.data, productDescription: description };

              const product = await prisma.product.create({
                data: {
                  name: ctx.session.data.productName,
                  price: ctx.session.data.productPrice,
                  description,
                  isActive: true,
                },
              });

              await logAction({ action: 'PRODUCT_CREATED', details: { productId: product.id, name: product.name } });
              await ctx.editMessage(`✅ Produto "${product.name}" criado com sucesso! ID: ${product.id}`);
              ctx.session.data = {};
            },
          });
        },
      });
    },
  });
}

// Edita produto (menu de campos)
export async function editProduct(ctx: Context, productId: number) {
  if (!(await isAdmin(ctx))) return;
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return ctx.editMessage('Produto não encontrado.');

  await ctx.editMessage(`Editando produto #${product.id} - ${product.name}\n\nEscolha o campo:`, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '📝 Nome', callback_data: `prod_edit_name_${product.id}` }],
        [{ text: '💰 Preço', callback_data: `prod_edit_price_${product.id}` }],
        [{ text: '📄 Descrição', callback_data: `prod_edit_desc_${product.id}` }],
        [{ text: '🖼 Imagem', callback_data: `prod_edit_image_${product.id}` }],
        [{ text: product.isActive ? '❌ Desativar' : '✅ Ativar', callback_data: `prod_toggle_${product.id}` }],
        [{ text: '🗑 Excluir', callback_data: `prod_delete_${product.id}` }],
        [{ text: '⏮️ Voltar', callback_data: 'prod_list' }],
      ],
    },
  });
}

// Altera nome
export async function editProductName(ctx: Context, productId: number) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, `prod_edit_name_${productId}`, 'Digite o novo nome:', {
    validate: async (input) => input.trim().length > 0 ? null : 'Nome inválido.',
    onSuccess: async (ctx, name) => {
      await prisma.product.update({ where: { id: productId }, data: { name } });
      await logAction({ action: 'PRODUCT_NAME_UPDATED', details: { productId, name } });
      await ctx.editMessage('✅ Nome atualizado.');
      await editProduct(ctx, productId);
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
      await editProduct(ctx, productId);
    },
  });
}

// Altera descrição
export async function editProductDescription(ctx: Context, productId: number) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, `prod_edit_desc_${productId}`, 'Digite a nova descrição (ou "-" para limpar):', {
    validate: async () => null,
    onSuccess: async (ctx, desc) => {
      const description = desc.trim() === '-' ? '' : desc;
      await prisma.product.update({ where: { id: productId }, data: { description } });
      await logAction({ action: 'PRODUCT_DESC_UPDATED', details: { productId } });
      await ctx.editMessage('✅ Descrição atualizada.');
      await editProduct(ctx, productId);
    },
  });
}

// Altera imagem
export async function editProductImage(ctx: Context, productId: number) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, `prod_edit_image_${productId}`, 'Envie a URL da imagem (ou "remover" para tirar):', {
    validate: async (input) => {
      if (input.toLowerCase() === 'remover') return null;
      return input.startsWith('http') ? null : 'URL inválida.';
    },
    onSuccess: async (ctx, imageUrl) => {
      const finalUrl = imageUrl.toLowerCase() === 'remover' ? null : imageUrl;
      await prisma.product.update({ where: { id: productId }, data: { imageUrl: finalUrl } });
      await logAction({ action: 'PRODUCT_IMAGE_UPDATED', details: { productId } });
      await ctx.editMessage('✅ Imagem atualizada.');
      await editProduct(ctx, productId);
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
  await editProduct(ctx, productId);
}

// Exclui produto
export async function deleteProduct(ctx: Context, productId: number) {
  if (!(await isAdmin(ctx))) return;
  await prisma.product.delete({ where: { id: productId } });
  await logAction({ action: 'PRODUCT_DELETED', details: { productId } });
  await ctx.editMessage('✅ Produto excluído.');
  await listProducts(ctx);
}

// ========== CATEGORIAS ==========

// Lista categorias
export async function listCategories(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const categories = await prisma.category.findMany({ orderBy: { order: 'asc' } });
  const text = categories.map(c => `#${c.id} - ${c.name} - ${c.isActive ? 'Ativa' : 'Inativa'}`).join('\n') || 'Nenhuma categoria.';

  const buttons = categories.map(c => [{ text: `✏️ ${c.name}`, callback_data: `cat_edit_${c.id}` }]);
  buttons.push([{ text: '➕ Nova categoria', callback_data: 'cat_new' }]);
  buttons.push([{ text: '⏮️ Voltar', callback_data: 'prod_list' }]);

  await ctx.editMessage(`🗂 CATEGORIAS\n\n${text}`, {
    reply_markup: { inline_keyboard: buttons },
  });
}

// Cria categoria
export async function createCategory(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, 'cat_new_name', 'Digite o nome da categoria:', {
    validate: async (input) => input.trim().length > 0 ? null : 'Nome inválido.',
    onSuccess: async (ctx, name) => {
      await prisma.category.create({ data: { name } });
      await logAction({ action: 'CATEGORY_CREATED', details: { name } });
      await ctx.editMessage(`✅ Categoria "${name}" criada.`);
      await listCategories(ctx);
    },
  });
}

// Edita categoria (nome)
export async function editCategoryName(ctx: Context, categoryId: number) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, `cat_edit_name_${categoryId}`, 'Digite o novo nome:', {
    validate: async (input) => input.trim().length > 0 ? null : 'Nome inválido.',
    onSuccess: async (ctx, name) => {
      await prisma.category.update({ where: { id: categoryId }, data: { name } });
      await logAction({ action: 'CATEGORY_NAME_UPDATED', details: { categoryId, name } });
      await ctx.editMessage('✅ Categoria atualizada.');
      await listCategories(ctx);
    },
  });
}

// Exclui categoria
export async function deleteCategory(ctx: Context, categoryId: number) {
  if (!(await isAdmin(ctx))) return;
  await prisma.category.delete({ where: { id: categoryId } });
  await logAction({ action: 'CATEGORY_DELETED', details: { categoryId } });
  await ctx.editMessage('✅ Categoria excluída.');
  await listCategories(ctx);
}
