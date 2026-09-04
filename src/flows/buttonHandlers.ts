import { Context } from '../types/context';
import { showProduct } from '../screens/product';
import { goToScreen } from '../screens/manager';
import { startPixPayment } from '../flows/pixPayment';

// Handler para botão "Comprar"
export async function handleBuyButton(ctx: Context, productId: number) {
  await showProduct(ctx, productId);
}

// Handler para botão "Adicionar Saldo"
export async function handleAddBalanceButton(ctx: Context) {
  await goToScreen(ctx, 'recarregar');
}

// Handler para botão "Cadastrar"
export async function handleRegisterButton(ctx: Context) {
  // Usuário já está cadastrado, apenas volta para o início
  await goToScreen(ctx, 'start');
}

// Handler para botão "Suporte" (se não for URL, envia mensagem de suporte)
export async function handleSupportButton(ctx: Context) {
  const supportLink = await prisma.setting.findUnique({ where: { key: 'support_link' } });
  const link = supportLink?.value || 'https://t.me/larizinhastorebot';
  await ctx.reply(`🆘 Suporte: ${link}`);
}

// Handler genérico para callbacks de botões dinâmicos
export async function handleDynamicButton(ctx: Context, type: string, value?: string) {
  switch (type) {
    case 'comprar':
      await handleBuyButton(ctx, parseInt(value!));
      break;
    case 'adicionar_saldo':
      await handleAddBalanceButton(ctx);
      break;
    case 'cadastrar':
      await handleRegisterButton(ctx);
      break;
    case 'suporte':
      await handleSupportButton(ctx);
      break;
    default:
      await ctx.answerCbQuery('Ação não reconhecida.');
  }
}
