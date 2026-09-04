import { Request, Response, NextFunction } from 'express';
import prisma from '../database';

// Middleware de segurança por dispositivo/IP
export async function deviceSecurityMiddleware(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).userId; // definido após autenticação
  if (!userId) return res.status(401).json({ error: 'Não autorizado' });

  // Obtém IP e user-agent do request
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const userAgent = req.headers['user-agent'] || 'unknown';

  // Busca o dispositivo registrado para o usuário
  const device = await prisma.device.findFirst({
    where: { userId },
    orderBy: { lastUsedAt: 'desc' },
  });

  if (!device) {
    // Primeiro acesso: registra o dispositivo
    await prisma.device.create({
      data: {
        userId,
        ip,
        userAgent,
        lastUsedAt: new Date(),
      },
    });
    return next();
  }

  // Verifica se IP e user-agent são iguais
  const sameIp = device.ip === ip;
  const sameUserAgent = device.userAgent === userAgent;

  // Busca configuração de segurança
  const securitySetting = await prisma.setting.findUnique({
    where: { key: 'device_security' },
  });
  const strictMode = securitySetting?.value?.strict || false; // padrão: apenas IP

  if (strictMode) {
    // Modo estrito: exige IP e user-agent iguais
    if (!sameIp || !sameUserAgent) {
      return res.status(403).json({ error: 'Dispositivo não reconhecido. Acesso bloqueado.' });
    }
  } else {
    // Modo padrão: apenas IP precisa ser igual
    if (!sameIp) {
      return res.status(403).json({ error: 'IP diferente detectado. Acesso bloqueado.' });
    }
  }

  // Atualiza último uso
  await prisma.device.update({
    where: { id: device.id },
    data: { lastUsedAt: new Date() },
  });

  next();
}
