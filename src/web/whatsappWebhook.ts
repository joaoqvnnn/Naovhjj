import { Router } from 'express';
import { handleIncomingWhatsAppMessage } from '../services/whatsappApi';

const router = Router();

// Endpoint para receber mensagens do WhatsApp (Evolution API)
router.post('/webhook', async (req, res) => {
  try {
    await handleIncomingWhatsAppMessage(req.body);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Erro no webhook WhatsApp:', error);
    res.status(500).send('Erro');
  }
});

export default router;
