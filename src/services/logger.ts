import prisma from '../database';

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

interface LogOptions {
  userId?: number;
  action: string;
  details?: any;
  level?: LogLevel;
}

export async function logAction(options: LogOptions) {
  const { userId, action, details, level = 'INFO' } = options;
  try {
    // Registra no banco
    await prisma.log.create({
      data: {
        userId,
        action,
        details: details ? JSON.parse(JSON.stringify(details)) : undefined,
      },
    });
  } catch (error) {
    // Se falhar no banco, pelo menos loga no console
    console.error('Falha ao gravar log no banco:', error);
  }

  // Loga no console com timestamp
  const timestamp = new Date().toISOString();
  const userStr = userId ? ` [User: ${userId}]` : '';
  console.log(`[${timestamp}] [${level}]${userStr} ${action}`, details || '');
}

// Funções de conveniência
export const logger = {
  info: (action: string, details?: any, userId?: number) => logAction({ action, details, userId, level: 'INFO' }),
  warn: (action: string, details?: any, userId?: number) => logAction({ action, details, userId, level: 'WARN' }),
  error: (action: string, details?: any, userId?: number) => logAction({ action, details, userId, level: 'ERROR' }),
  debug: (action: string, details?: any, userId?: number) => logAction({ action, details, userId, level: 'DEBUG' }),
};
