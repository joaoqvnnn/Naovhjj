import axios from 'axios';

/**
 * Transcreve um áudio usando a API da OpenAI Whisper.
 * @param audioBuffer Buffer contendo o áudio binário
 * @param mimeType Tipo MIME do áudio (ex: audio/ogg, audio/mp3, audio/wav)
 * @returns Texto transcrito ou null se falhar
 */
export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY não configurada para transcrição.');
    return null;
  }

  try {
    // Cria FormData para envio do arquivo
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', audioBuffer, {
      filename: `audio.${mimeType.split('/')[1] || 'ogg'}`,
      contentType: mimeType,
    });
    form.append('model', 'whisper-1');
    form.append('language', 'pt');

    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${apiKey}`,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    return response.data.text?.trim() || null;
  } catch (error) {
    console.error('Erro na transcrição de áudio:', error);
    return null;
  }
}
