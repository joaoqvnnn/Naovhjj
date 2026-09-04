import { Context } from '../types/context';
import prisma from '../database';
import { isAdmin } from './userManagement';
import { startCapture } from '../middlewares/capture';
import { logAction } from '../services/logger';

// Chaves de configuração de botões (equivalem às telas)
const BUTTON_KEYS = [
  'menu_principal',
  'menu_produto',
  'menu_perfil',
  'menu_recarregar',
  'menu_afiliados',
  'menu_ranking',
  'menu_saque',
  'menu_historico',
  'menu_giftcard',
  'menu_alerta',
];

// Mostra lista de telas com botões editáveis
export async function showButtonList(ctx: Context) {
  if (!(await isAdmin(ctx))) return;

  const buttons = BUTTON_KEYS.map(key => [{
    text: `🔘 ${key}`,
    callback_data: `button_view_${key}`,
  }]);

  buttons.push([{ text: '⏮️ Voltar', callback_data: 'admin_config' }]);

  await ctx.editMessage(
    `🔘 EDITOR DE BOTÕES\n\nSelecione a tela para editar os botões:`,
    { reply_markup: { inline_keyboard: buttons } }
  );
}

// Visualiza a configuração de botões de uma tela
export async function viewButtonConfig(ctx: Context, key: string) {
  if (!(await isAdmin(ctx))) return;

  const config = await prisma.buttonConfig.findUnique({ where: { key } });
  const buttons = config?.buttons as any[] || [];

  let text = `🔘 Botões da tela: ${key}\n\n`;
  if (buttons.length === 0) {
    text += `Nenhum botão configurado (usa padrão).\n`;
  } else {
    buttons.forEach((btn, i) => {
      text += `${i + 1}. ${btn.text} -> ${btn.callback_data}\n`;
    });
  }

  await ctx.editMessage(text, {
    reply_markup: {
      inline_keyboard: [
        [{ text: '➕ Adicionar botão', callback_data: `button_add_${key}` }],
        [{ text: '🔄 Reordenar', callback_data: `button_reorder_${key}` }],
        [{ text: '♻️ Restaurar padrão', callback_data: `button_reset_${key}` }],
        [{ text: '⏮️ Voltar', callback_data: 'button_list' }],
      ],
    },
  });
}

// Adiciona um novo botão à configuração
export async function addButton(ctx: Context, key: string) {
  if (!(await isAdmin(ctx))) return;

  await startCapture(ctx, `button_add_${key}`, 'Digite no formato: Texto | callback_data (ex: Comprar | comprar_1):', {
    validate: async (input) => {
      const parts = input.split('|').map(s => s.trim());
      if (parts.length !== 2) return '❌ Formato inválido. Use: Texto | callback_data';
      return null;
    },
    onSuccess: async (ctx, input) => {
      const [text, callbackData] = input.split('|').map(s => s.trim());
      const config = await prisma.buttonConfig.findUnique({ where: { key } });
      let buttons = config?.buttons as any[] || [];
      buttons.push({ text, callback_data: callbackData });
      await prisma.buttonConfig.upsert({
        where: { key },
        update: { buttons },
        create: { key, buttons },
      });
      await logAction({ action: 'BUTTON_ADDED', details: { key, text, callbackData, by: ctx.from?.id } });
      await ctx.editMessage(`✅ Botão adicionado.`);
      await viewButtonConfig(ctx, key);
    },
  });
}

// Reordena botões (simples: captura nova ordem separada por vírgula)
export async function reorderButtons(ctx: Context, key: string) {
  if (!(await isAdmin(ctx))) return;

  const config = await prisma.buttonConfig.findUnique({ where: { key } });
  const buttons = config?.buttons as any[] || [];
  if (buttons.length < 2) {
    await ctx.editMessage('❌ Não há botões suficientes para reordenar.');
    return;
  }

  const listStr = buttons.map((b, i) => `${i + 1}. ${b.text}`).join('\n');
  await startCapture(ctx, `button_reorder_${key}`, `Digite a nova ordem separada por vírgula (ex: 2,1,3):\n\n${listStr}`, {
    validate: async (input) => {
      const nums = input.split(',').map(n => parseInt(n.trim()));
      if (nums.some(isNaN) || nums.length !== buttons.length) return '❌ Ordem inválida.';
      return null;
    },
    onSuccess: async (ctx, input) => {
      const nums = input.split(',').map(n => parseInt(n.trim()) - 1);
      const reordered = nums.map(i => buttons[i]);
      await prisma.buttonConfig.update({
        where: { key },
        data: { buttons: reordered },
      });
      await logAction({ action: 'BUTTONS_REORDERED', details: { key, by: ctx.from?.id } });
      await ctx.editMessage(`✅ Botões reordenados.`);
      await viewButtonConfig(ctx, key);
    },
  });
}

// Restaura botões padrão
export async function resetButtons(ctx: Context, key: string) {
  if (!(await isAdmin(ctx))) return;
  await prisma.buttonConfig.deleteMany({ where: { key } });
  await logAction({ action: 'BUTTONS_RESET', details: { key, by: ctx.from?.id } });
  await ctx.editMessage(`♻️ Botões de "${key}" restaurados ao padrão.`);
  await viewButtonConfig(ctx, key);
}
