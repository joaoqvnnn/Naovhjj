import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';

const BUTTON_KEYS = [
  'menu_principal', 'menu_produto', 'menu_perfil', 'menu_recarregar',
  'menu_afiliados', 'menu_ranking', 'menu_saque', 'menu_historico',
  'menu_giftcard', 'menu_alerta', 'menu_admin',
];

export async function showButtonList(ctx: Context) {
  if (!(await isAdmin(ctx))) return;
  const buttons = BUTTON_KEYS.map(key => [{ text: `🔘 ${key}`, callback_data: `btnlist_${key}` }]);
  buttons.push([{ text: '⏮️ Voltar', callback_data: 'admin_menu_actions' }]);

  await ctx.editMessage('🔘 Editor de Botões\n\nSelecione a tela:', {
    reply_markup: { inline_keyboard: buttons },
  });
}

export async function viewButtonConfig(ctx: Context, key: string) {
  if (!(await isAdmin(ctx))) return;

  const config = await prisma.buttonConfig.findUnique({ where: { key } });
  const buttons = (config?.buttons as any[]) || [];

  let text = `🔘 Tela: ${key}\n\n`;
  if (!buttons.length) {
    text += 'Nenhum botão customizado (usa padrão).';
  } else {
    buttons.forEach((btn, i) => {
      text += `${i + 1}. ${btn.text} → ${btn.callback_data}\n`;
    });
  }

  const inline: any[] = [];
  buttons.forEach((btn, i) => {
    inline.push([{ text: `✏️ Editar ${btn.text}`, callback_data: `btnedit_${key}_${i}` }]);
    inline.push([{ text: `🗑️ Remover ${btn.text}`, callback_data: `btnremove_${key}_${i}` }]);
  });
  inline.push([{ text: '➕ Adicionar botão', callback_data: `btnadd_${key}` }]);
  inline.push([{ text: '🔄 Reordenar', callback_data: `btnreorder_${key}` }]);
  inline.push([{ text: '♻️ Restaurar padrão', callback_data: `btnreset_${key}` }]);
  inline.push([{ text: '⏮️ Voltar', callback_data: 'admin_actions_buttons' }]);

  await ctx.editMessage(text, { reply_markup: { inline_keyboard: inline } });
}

export async function addButton(ctx: Context, key: string) {
  if (!(await isAdmin(ctx))) return;
  await startCapture(ctx, `btnadd_${key}`, 'Digite no formato: Texto | callback_data', {
    validate: async (input) => input.includes('|') ? null : 'Formato inválido.',
    onSuccess: async (ctx, input) => {
      const [text, callback_data] = input.split('|').map(s => s.trim());
      const config = await prisma.buttonConfig.findUnique({ where: { key } });
      const buttons = (config?.buttons as any[]) || [];
      buttons.push({ text, callback_data });
      await prisma.buttonConfig.upsert({ where: { key }, update: { buttons }, create: { key, buttons } });
      await ctx.editMessage('✅ Botão adicionado.');
      await viewButtonConfig(ctx, key);
    },
  });
}

export async function editButton(ctx: Context, key: string, index: number) {
  if (!(await isAdmin(ctx))) return;
  const config = await prisma.buttonConfig.findUnique({ where: { key } });
  const buttons = (config?.buttons as any[]) || [];
  if (!buttons[index]) return ctx.editMessage('Botão não encontrado.');

  await startCapture(ctx, `btnedit_${key}_${index}`, `Editando "${buttons[index].text}". Digite: Texto | callback_data`, {
    validate: async (input) => input.includes('|') ? null : 'Formato inválido.',
    onSuccess: async (ctx, input) => {
      const [text, callback_data] = input.split('|').map(s => s.trim());
      buttons[index] = { text, callback_data };
      await prisma.buttonConfig.update({ where: { key }, data: { buttons } });
      await ctx.editMessage('✅ Botão atualizado.');
      await viewButtonConfig(ctx, key);
    },
  });
}

export async function removeButton(ctx: Context, key: string, index: number) {
  if (!(await isAdmin(ctx))) return;
  const config = await prisma.buttonConfig.findUnique({ where: { key } });
  const buttons = (config?.buttons as any[]) || [];
  if (!buttons[index]) return ctx.editMessage('Botão não encontrado.');
  buttons.splice(index, 1);
  await prisma.buttonConfig.update({ where: { key }, data: { buttons } });
  await ctx.editMessage('✅ Botão removido.');
  await viewButtonConfig(ctx, key);
}

export async function reorderButtons(ctx: Context, key: string) {
  if (!(await isAdmin(ctx))) return;
  const config = await prisma.buttonConfig.findUnique({ where: { key } });
  const buttons = (config?.buttons as any[]) || [];
  if (buttons.length < 2) return ctx.editMessage('Poucos botões para reordenar.');

  const listStr = buttons.map((b, i) => `${i + 1}. ${b.text}`).join('\n');
  await startCapture(ctx, `btnreorder_${key}`, `Digite nova ordem (ex: 2,1,3):\n\n${listStr}`, {
    validate: async (input) => {
      const nums = input.split(',').map(n => parseInt(n.trim()));
      return nums.some(isNaN) || nums.length !== buttons.length ? 'Ordem inválida.' : null;
    },
    onSuccess: async (ctx, input) => {
      const nums = input.split(',').map(n => parseInt(n.trim()) - 1);
      const reordered = nums.map(i => buttons[i]);
      await prisma.buttonConfig.update({ where: { key }, data: { buttons: reordered } });
      await ctx.editMessage('✅ Botões reordenados.');
      await viewButtonConfig(ctx, key);
    },
  });
}

export async function resetButtons(ctx: Context, key: string) {
  if (!(await isAdmin(ctx))) return;
  await prisma.buttonConfig.deleteMany({ where: { key } });
  await ctx.editMessage('♻️ Botões restaurados.');
  await viewButtonConfig(ctx, key);
}
