import type { CatalogRequestMetrics } from './request-metrics.ts';

export type OrderPage = {
  first?: number;
  after?: string;
};

export function createOrderLoader<OrderConnection>(
  batch: (
    requests: readonly { subject: string; page: OrderPage }[],
  ) => Promise<readonly OrderConnection[]>,
  metrics: CatalogRequestMetrics,
) {
  const cache = new Map<string, Promise<OrderConnection>>();
  let queue: Array<{
    subject: string;
    page: OrderPage;
    resolve: (value: OrderConnection) => void;
    reject: (reason: unknown) => void;
  }> = [];

  async function flush() {
    const current = queue;
    queue = [];
    metrics.calls += 1;
    metrics.batches.push(current.length);
    try {
      const orders = await batch(current.map(({ subject, page }) => ({ subject, page })));
      if (orders.length !== current.length) throw new Error('Order batch order mismatch');
      current.forEach(({ resolve }, index) => resolve(orders[index]!));
    } catch (error) {
      current.forEach(({ reject }) => reject(error));
    }
  }

  return {
    load(subject: string, page: OrderPage = {}) {
      const key = JSON.stringify([subject, page.first, page.after]);
      const cached = cache.get(key);
      if (cached) return cached;
      const result = new Promise<OrderConnection>((resolve, reject) => {
        queue.push({ subject, page, resolve, reject });
        if (queue.length === 1) queueMicrotask(flush);
      });
      cache.set(key, result);
      return result;
    },
  };
}
