import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';
import { logAction } from '../services/logger';

// Lista completa de chaves de botões (telas)
export const ALL_BUTTON_KEYS = [
  'menu_principal', 'menu_produto', 'menu_perfil', 'menu_recarregar',
  'menu_afiliados', 'menu_ranking', 'menu_saque', 'menu_historico',
  'menu_giftcard', 'menu_alerta', 'menu_admin', 'menu_pix',
  'menu_categorias', 'menu_entrega',
];

// Mostra lista de telas
export async function showAllButtonLists(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const buttons = ALL_BUTTON_KEYS.map(key => [{ text: `🔘 ${key}`, callback_data: `btnlist_full_${key}` }]);
  buttons.push([{ text: '⏮️ Voltar', callback_data: 'admin_config' }]);
  await ctx.editMessage('🔘 EDITOR DE BOTÕES (COMPLETO)\n\nSelecione a tela:', { reply_markup: { inline_keyboard: buttons } });
}

// Visualiza botões de uma tela
export async function viewButtonsFull(ctx: Context, key: string) {
  if (!(await isAdmin(ctx))) return;
  const config = await prisma.buttonConfig.findUnique({ where: { key } });
  const buttons = (config?.buttons as any[]) || [];

  let text = `🔘 Tela: ${key}\n\n`;
  if (!buttons.length) text += `Nenhum botão customizado (usa padrão).\n`;
  else buttons.forEach((btn, i) => text += `${i + 1}. ${btn.text} → ${btn.callback_data}\n`);

  const inline: any[] = [];
  buttons.forEach((btn, i) => {
    inline.push([{ text: `✏️ Editar ${btn.text}`, callback_data: `btnedit_full_${key}_${i}` }]);
    inline.push([{ text: `🗑️ Remover ${btn.text}`, callback_data: `btnremove_full_${key}_${i}` }]);
  });
  inline.push([{ text: '➕ Adicionar botão', callback_data: `btnadd_full_${key}` }]);
  inline.push([{ text: '🔄 Reordenar', callback_data: `btnreorder_full_${key}` }]);
  inline.push([{ text: '♻️ Restaurar padrão', callback_data: `btnreset_full_${key}` }]);
  inline.push([{ text: '⏮️ Voltar', callback_data: 'button_list_full' }]);

  await ctx.editMessage(text, { reply_markup: { inline_keyboard: inline } });
}

// Adiciona botão
export async function addButtonFull(ctx: Context, key: string) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, `btnadd_full_${key}`, 'Digite no formato: Texto | callback_data (ex: Comprar | comprar_1):', {
    validate: async (input) => {
      const parts = input.split('|').map(s => s.trim());
      if (parts.length !== 2) return '❌ Formato inválido.';
      return null;
    },
    onSuccess: async (ctx, input) => {
      const [text, callback_data] = input.split('|').map(s => s.trim());
      const config = await prisma.buttonConfig.findUnique({ where: { key } });
      const buttons = (config?.buttons as any[]) || [];
      buttons.push({ text, callback_data });
      await prisma.buttonConfig.upsert({ where: { key }, update: { buttons }, create: { key, buttons } });
      await logAction({ action: 'BUTTON_ADDED', details: { key, text, callback_data } });
      await ctx.editMessage('✅ Botão adicionado.');
      await viewButtonsFull(ctx, key);
    },
  });
}

// Edita botão existente
export async function editButtonFull(ctx: Context, key: string, index: number) {
  if (!(await isAdmin(ctx))) return;
  const config = await prisma.buttonConfig.findUnique({ where: { key } });
  const buttons = (config?.buttons as any[]) || [];
  if (!buttons[index]) return ctx.editMessage('❌ Botão não encontrado.');

  await startCapture(ctx, `btnedit_full_${key}_${index}`, `Editando "${buttons[index].text}". Digite novo formato: Texto | callback_data`, {
    validate: async (input) => {
      const parts = input.split('|').map(s => s.trim());
      if (parts.length !== 2) return '❌ Formato inválido.';
      return null;
    },
    onSuccess: async (ctx, input) => {
      const [text, callback_data] = input.split('|').map(s => s.trim());
      buttons[index] = { text, callback_data };
      await prisma.buttonConfig.update({ where: { key }, data: { buttons } });
      await logAction({ action: 'BUTTON_EDITED', details: { key, index, text, callback_data } });
      await ctx.editMessage('✅ Botão atualizado.');
      await viewButtonsFull(ctx, key);
    },
  });
}

// Remove botão
export async function removeButtonFull(ctx: Context, key: string, index: number) {
  if (!(await isAdmin(ctx))) return;
  const config = await prisma.buttonConfig.findUnique({ where: { key } });
  const buttons = (config?.buttons as any[]) || [];
  if (!buttons[index]) return ctx.editMessage('❌ Botão não encontrado.');
  buttons.splice(index, 1);
  await prisma.buttonConfig.update({ where: { key }, data: { buttons } });
  await logAction({ action: 'BUTTON_REMOVED', details: { key, index } });
  await ctx.editMessage('✅ Botão removido.');
  await viewButtonsFull(ctx, key);
}

// Reordena botões
export async function reorderButtonsFull(ctx: Context, key: string) {
  if (!(await isAdmin(ctx))) return;
  const config = await prisma.buttonConfig.findUnique({ where: { key } });
  const buttons = (config?.buttons as any[]) || [];
  if (buttons.length < 2) return ctx.editMessage('❌ Poucos botões para reordenar.');
  const listStr = buttons.map((b, i) => `${i + 1}. ${b.text}`).join('\n');
  await startCapture(ctx, `btnreorder_full_${key}`, `Digite nova ordem (ex: 2,1,3):\n\n${listStr}`, {
    validate: async (input) => {
      const nums = input.split(',').map(n => parseInt(n.trim()));
      if (nums.some(isNaN) || nums.length !== buttons.length) return '❌ Ordem inválida.';
      return null;
    },
    onSuccess: async (ctx, input) => {
      const nums = input.split(',').map(n => parseInt(n.trim()) - 1);
      const reordered = nums.map(i => buttons[i]);
      await prisma.buttonConfig.update({ where: { key }, data: { buttons: reordered } });
      await logAction({ action: 'BUTTONS_REORDERED', details: { key } });
      await ctx.editMessage('✅ Botões reordenados.');
      await viewButtonsFull(ctx, key);
    },
  });
}

// Restaura padrão
export async function resetButtonsFull(ctx: Context, key: string) {
  if (!(await isAdmin(ctx))) return;
  await prisma.buttonConfig.deleteMany({ where: { key } });
  await logAction({ action: 'BUTTONS_RESET', details: { key } });
  await ctx.editMessage('♻️ Botões restaurados ao padrão.');
  await viewButtonsFull(ctx, key);
}
