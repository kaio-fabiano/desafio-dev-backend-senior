import type { CatalogRequestMetrics } from './request-metrics.ts';

export function createProductLoader<Product>(
  batch: (ids: readonly string[]) => Promise<readonly (Product | null)[]>,
  metrics: CatalogRequestMetrics,
) {
  const cache = new Map<string, Promise<Product | null>>();
  let queue: Array<{
    id: string;
    resolve: (value: Product | null) => void;
    reject: (reason: unknown) => void;
  }> = [];

  async function flush() {
    const current = queue;
    queue = [];
    const ids = current.map(({ id }) => id);
    metrics.calls += 1;
    metrics.batches.push(ids.length);
    try {
      const products = await batch(ids);
      if (products.length !== ids.length) throw new Error('Product batch order mismatch');
      current.forEach(({ resolve }, index) => resolve(products[index] ?? null));
    } catch (error) {
      current.forEach(({ reject }) => reject(error));
    }
  }

  return {
    load(id: string) {
      const cached = cache.get(id);
      if (cached) return cached;
      const result = new Promise<Product | null>((resolve, reject) => {
        queue.push({ id, resolve, reject });
        if (queue.length === 1) queueMicrotask(flush);
      });
      cache.set(id, result);
      return result;
    },
  };
}
