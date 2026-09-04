import { Router, Request, Response } from 'express';
import prisma from '../database';

const router = Router();

router.get('/termos', async (req, res) => {
  // Busca o conteúdo dos termos
  const template = await prisma.messageTemplate.findUnique({
    where: { key: 'termos' },
  });

  const conteudo = template?.text || 'Termos de uso não configurados.';

  // Layout profissional sem emojis
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Termos de Uso - Larizinha Store</title>
  <style>
    :root {
      --bg: #f9fafb;
      --surface: #ffffff;
      --text: #1f2937;
      --border: #e5e7eb;
      --primary: #2563eb;
      --secondary: #4b5563;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
      padding: 40px 20px;
      line-height: 1.6;
    }
    .container {
      background-color: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
      max-width: 800px;
      width: 100%;
      padding: 40px;
    }
    h1 {
      font-size: 28px;
      font-weight: 600;
      margin-bottom: 24px;
      color: var(--primary);
      border-bottom: 2px solid var(--border);
      padding-bottom: 12px;
    }
    p {
      margin-bottom: 16px;
      color: var(--secondary);
    }
    .content {
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    a {
      color: var(--primary);
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    @media (max-width: 600px) {
      .container {
        padding: 20px;
      }
      h1 {
        font-size: 24px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Termos de Uso</h1>
    <div class="content">${conteudo.replace(/\n/g, '<br>')}</div>
  </div>
</body>
</html>`;

  res.send(html);
});

export default router;
