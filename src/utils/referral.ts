import bot from '../bot';

export async function getAffiliateLink(userId: number): Promise<string> {
  try {
    const botInfo = await bot.telegram.getMe();
    const username = botInfo.username;
    if (!username) {
      // fallback caso não tenha username (incomum)
      return `https://t.me/seubot?start=${userId}`;
    }
    return `https://t.me/${username}?start=${userId}`;
  } catch (error) {
    console.error('Erro ao obter username do bot:', error);
    return `https://t.me/seubot?start=${userId}`;
  }
}
