import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';
import { formatCurrency } from '../utils/format';

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
  let text = `📦 Produtos (página ${page + 1}/${totalPages})\n\n`;
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

  await ctx.editMessage(text, { reply_markup: { inline_keyboard: buttons } });
}

export async function createProduct(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  await startCapture(ctx, 'prod_new_name', 'Digite o nome do produto:', {
    validate: async (input) => input.trim().length > 0 ? null : 'Nome inválido.',
    onSuccess: async (ctx, name) => {
      await startCapture(ctx, 'prod_new_price', 'Digite o preço:', {
        validate: async (input) => {
          const num = parseFloat(input.replace(',', '.'));
          return isNaN(num) || num <= 0 ? 'Preço inválido.' : null;
        },
        onSuccess: async (ctx, price) => {
          const product = await prisma.product.create({
            data: { name, price: parseFloat(price.replace(',', '.')), isActive: true },
          });
          await ctx.editMessage(`✅ Produto "${name}" criado! ID: ${product.id}`);
          await listProducts(ctx);
        },
      });
    },
  });
}

export async function editProduct(ctx: Context, productId: number) {
  if (!(await isAdmin(ctx))) return;
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return ctx.editMessage('Produto não encontrado.');

  await ctx.editMessage(`Editando produto #${product.id} - ${product.name}\n\nEscolha:`, {
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

export async function editProductName(ctx: Context, productId: number) {
  if (!(await isAdmin(ctx))) return;
  await startCapture
