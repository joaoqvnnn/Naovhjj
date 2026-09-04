import bot from './bot';
import prisma from './database';
import config from './config';
import express from 'express';
import cors from 'cors';
import http from 'http';

// Importa rotas web (serão criadas posteriormente, mas já deixamos o servidor pronto)
// import webRoutes from './web/routes';

async function startBot() {
  try {
    // Conecta ao banco de dados
    await prisma.$connect();
    console.log('✅ Banco de dados conectado.');

    // Inicia o bot (long polling)
    await bot.launch();
    console.log('🤖 Bot iniciado com sucesso!');

    // Habilita parada graciosa
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
  } catch (error) {
    console.error('❌ Falha ao iniciar o bot:', error);
    process.exit(1);
  }
}

async function startWebServer() {
  const app = express();
  const server = http.createServer(app);

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Rota de saúde para monitoramento
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Aqui registraremos as rotas da Web (ativação, saque, termos, etc.)
  // app.use('/web', webRoutes);

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

// Inicia ambos
startBot();
startWebServer();
