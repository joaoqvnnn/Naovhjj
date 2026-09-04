import bot from './bot';
import supportBot from './supportBot';
import prisma from './database';
import config from './config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import cookieParser from 'cookie-parser';
import webRouter from './web';
import { startPixExpirationWorker } from './worker/pixExpirationWorker';
import { startScheduler } from './services/scheduler';

async function startBots() {
  try {
    await prisma.$connect();
    console.log('✅ Banco de dados conectado.');

    // Inicia bot principal (loja)
    await bot.launch();
    console.log('🤖 Bot da loja iniciado!');

    // Inicia bot de suporte (se token diferente)
    if (process.env.SUPPORT_BOT_TOKEN && process.env.SUPPORT_BOT_TOKEN !== process.env.BOT_TOKEN) {
      await supportBot.launch();
      console.log('🎧 Bot de suporte iniciado!');
    }

    // Inicia worker de expiração de Pix
    startPixExpirationWorker();
    console.log('⏳ Worker de expiração Pix iniciado.');

    // Inicia scheduler de promoções agendadas
    startScheduler();
    console.log('📅 Scheduler de promoções iniciado.');

    // Encerramento gracioso
    process.once('SIGINT', () => {
      bot.stop('SIGINT');
      supportBot.stop('SIGINT');
    });
    process.once('SIGTERM', () => {
      bot.stop('SIGTERM');
      supportBot.stop('SIGTERM');
    });
  } catch (error) {
    console.error('❌ Falha ao iniciar bots:', error);
    process.exit(1);
  }
}

async function startWebServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // Rota de saúde
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Rotas web (autenticação, saque, termos, ativação, etc.)
  app.use('/web', webRouter);

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`🌐 Servidor Web rodando na porta ${port}`);
  });

  // Encerramento gracioso
  const shutdown = async () => {
    server.close(async () => {
      await prisma.$disconnect();
      console.log('🔌 Conexões fechadas. Encerrando.');
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Inicia todos os serviços
startBots();
startWebServer();
