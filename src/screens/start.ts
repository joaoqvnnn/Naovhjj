import { Context } from '../types/context';
import { registerScreen } from './manager';
import prisma from '../database';
import { formatCurrency } from '../utils/format';

// Registra a tela inicial
registerScreen({
  id: 'start',
  render: async (ctx: Context) => {
    const userId = ctx.from!.id;
    const user = await prisma.user.findUnique({
      where: { telegramId: BigInt(userId) },
    });

    if (!user) {
      // Usuário novo, cria
      const newUser = await prisma.user.create({
        data: {
          telegramId: BigInt(userId),
          username: ctx.from?.username || ctx.from?.first_name,
        },
      });
      // Rebusca para ter o objeto completo
      return renderStartScreen(ctx, newUser);
    }
    return renderStartScreen(ctx, user);
  },
});

async function renderStartScreen(ctx: Context, user: any) {
  // Tenta buscar template personalizado
  const template = await prisma.messageTemplate.findUnique({
    where: { key: 'start' },
  });

  let text = '';
  if (template) {
    // Substitui variáveis dinâmicas
    text = template.text
      .replace(/\{nome_loja\}/g, 'Larizinha Store')
      .replace(/\{usuario\}/g, ctx.from?.username || ctx.from?.first_name || '')
      .replace(/\{telegram_id\}/g, String(user.telegramId))
      .replace(/\{saldo\}/g, formatCurrency(user.balance));
  } else {
    // Texto padrão
    text = `🎬 Bem-vindo à Larizinha Store! ✨\n` +
      `A sua central de streamings com entrega 100% automática.\n\n` +
      `💠 Seus Dados:\n` +
      `├ 👤 ID: ${user.telegramId}\n` +
      `└ 💰 Saldo Atual: ${formatCurrency(user.balance)}\n\n` +
      `👇 COMO COMEÇAR:\n` +
      `Clique no botão abaixo…`;
  }

  // Botões padrão ou customizados
  const buttonsConfig = await prisma.buttonConfig.findUnique({
    where: { key: 'menu_principal' },
  });

  let keyboard;
  if (buttonsConfig) {
    keyboard = { inline_keyboard: buttonsConfig.buttons };
  } else {
    keyboard = {
      inline_keyboard: [
        [{ text: '🛍️ Comprar', callback_data: 'menu_comprar' }],
        [{ text: '👤 Meu Perfil', callback_data: 'menu_perfil' }],
        [{ text: '💰 Recarregar', callback_data: 'menu_recarregar' }],
        [{ text: '🤝 Afiliados', callback_data: 'menu_afiliados' }],
        [{ text: '🏆 Ranking', callback_data: 'menu_ranking' }],
      ],
    };
  }

  return { text, keyboard };
}
