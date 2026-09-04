import { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const limits = new Map<string, RateLimitEntry>();
const MAX_REQUESTS = 5;
const INTERVAL_MS = 60 * 60 * 1000; // 1 hora

export function passwordResetRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || 'unknown';
  const now = Date.now();

  if (!limits.has(ip)) {
    limits.set(ip, { count: 0, resetAt: now + INTERVAL_MS });
  }

  const entry = limits.get(ip)!;
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + INTERVAL_MS;
  }

  if (entry.count >= MAX_REQUESTS) {
    return res.status(429).send('Muitas solicitações. Tente novamente mais tarde.');
  }

  entry.count++;
  next();
}
