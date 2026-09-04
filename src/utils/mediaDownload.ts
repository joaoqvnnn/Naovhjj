import axios from 'axios';

/**
 * Baixa um arquivo de mídia a partir de uma URL (Telegram file link, WhatsApp media URL, etc.)
 * Retorna um Buffer com o conteúdo binário.
 */
export async function downloadMedia(url: string): Promise<Buffer | null> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000, // 15 segundos
    });
    return Buffer.from(response.data);
  } catch (error) {
    console.error('Erro ao baixar mídia:', error);
    return null;
  }
}
