import { Context } from '../types/context';
import prisma from '../database';

export async function cmdTermos(ctx: Context) {
  // Busca o template de termos salvo no banco
  const template = await prisma.messageTemplate.findUnique({
    where: { key: 'termos' },
  });

  // Se não houver template, usa um texto padrão
  const texto = template?.text || 'Termos de uso não configurados.';

  // Envia mensagem com formatação profissional (sem emojis)
  await ctx.replyWithHTML(
    `<b>Termos de Uso</b>\n\n` +
    texto.replace(/\n/g, '\n') // mantém quebras de linha
  );
}
