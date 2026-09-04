import axios from 'axios';

/**
 * Serviço de transcrição de áudio usando OpenAI Whisper API.
 * Pode ser substituído por outro provedor, mantendo a interface.
 */

export async function transcribeAudio(audioBuffer: Buffer, mimeType: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY não configurada para transcrição.');
    return null;
  }

  try {
    const formData = new FormData();
    const blob = new Blob([audioBuffer], { type: mimeType });
    formData.append('file', blob, 'audio.ogg');
    formData.append('model', 'whisper-1');
    formData.append('language', 'pt');

    const response = await axios.post('https://api.openai.com/v1/audio/transcriptions', formData, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data.text?.trim() || null;
  } catch (error) {
    console.error('Erro na transcrição:', error);
    return null;
  }
}
