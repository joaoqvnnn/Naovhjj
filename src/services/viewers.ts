interface ViewerEntry {
  userId: number;
  timestamp: number;
}

// Mapa: productId -> lista de viewers ativos
const viewersMap = new Map<number, ViewerEntry[]>();

// Tempo de expiração padrão (5 minutos), pode ser sobrescrito por Setting
const DEFAULT_EXPIRATION_MS = 5 * 60 * 1000;

async function getViewerExpiration(): Promise<number> {
  const { prisma } = await import('../database');
  const setting = await prisma.setting.findUnique({ where: { key: 'viewer_expiration_ms' } });
  return setting ? parseInt(setting.value.toString()) : DEFAULT_EXPIRATION_MS;
}

// Registra que um usuário está visualizando um produto
export function trackProductView(productId: number, userId: number) {
  if (!viewersMap.has(productId)) {
    viewersMap.set(productId, []);
  }
  const viewers = viewersMap.get(productId)!;
  const now = Date.now();
  // Remove visualizações antigas
  const updated = viewers.filter(v => now - v.timestamp < DEFAULT_EXPIRATION_MS);
  // Verifica se usuário já está na lista
  if (!updated.some(v => v.userId === userId)) {
    updated.push({ userId, timestamp: now });
  }
  viewersMap.set(productId, updated);
}

// Obtém o número de pessoas visualizando agora
export async function getCurrentViewers(productId: number): Promise<number> {
  const viewers = viewersMap.get(productId) || [];
  const expiration = await getViewerExpiration();
  const now = Date.now();
  const active = viewers.filter(v => now - v.timestamp < expiration);
  viewersMap.set(productId, active);
  return active.length;
}

// Remove visualizações expiradas (pode ser chamado por um worker)
export function cleanupViewers() {
  const now = Date.now();
  for (const [productId, viewers] of viewersMap.entries()) {
    const active = viewers.filter(v => now - v.timestamp < DEFAULT_EXPIRATION_MS);
    if (active.length > 0) {
      viewersMap.set(productId, active);
    } else {
      viewersMap.delete(productId);
    }
  }
}
