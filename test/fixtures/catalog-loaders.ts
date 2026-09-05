export type CatalogRequestMetrics = {
  calls: number;
  batches: number[];
};

export function createCatalogRequestMetrics(): CatalogRequestMetrics {
  return { calls: 0, batches: [] };
}

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
      const orders = await batch(
        current.map(({ subject, page }) => ({ subject, page })),
      );
      if (orders.length !== current.length) {
        throw new Error('Order batch order mismatch');
      }
      current.forEach(({ resolve }, index) => {
        const order = orders[index];
        if (order === undefined) throw new Error('Order batch order mismatch');
        resolve(order);
      });
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
      if (products.length !== ids.length) {
        throw new Error('Product batch order mismatch');
      }
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
