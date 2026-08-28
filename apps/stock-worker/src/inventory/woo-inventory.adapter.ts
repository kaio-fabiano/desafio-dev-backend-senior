type Fetch = (
  input: URL,
  init?: RequestInit,
) => Promise<Pick<Response, 'json' | 'ok' | 'status'>>;

export type StockItem = { productId: string; quantity: number };
type WooProduct = { id: number | string; stock_quantity: number | null };

export class InsufficientStockError extends Error {
  readonly code = 'INSUFFICIENT_STOCK';
}

export class WooInventoryRequestError extends Error {
  readonly code = 'WOO_INVENTORY_REQUEST_FAILED';

  constructor(readonly status: number) {
    super(`WooCommerce inventory request failed: ${status}`);
  }
}

export function createWooInventoryAdapter({
  endpoint,
  consumerKey,
  consumerSecret,
  request = fetch,
}: {
  endpoint: string;
  consumerKey: string;
  consumerSecret: string;
  request?: Fetch;
}) {
  const headers = {
    authorization: `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`,
    'content-type': 'application/json',
    ...(new URL(endpoint).protocol === 'http:'
      ? { 'x-forwarded-proto': 'https' }
      : {}),
  };
  const product = (id: string) => {
    const url = new URL(`/wp-json/wc/v3/products/${id}`, endpoint);
    url.searchParams.set('_fields', 'id,stock_quantity');
    return url;
  };

  async function get(id: string): Promise<WooProduct> {
    const response = await withDeadline(request(product(id), {
      headers,
      signal: AbortSignal.timeout(10_000),
    }));
    if (!response.ok) throw new WooInventoryRequestError(response.status);
    return (await response.json()) as WooProduct;
  }

  async function set(id: string, quantity: number): Promise<void> {
    const response = await withDeadline(request(product(id), {
      method: 'PUT',
      headers,
      body: JSON.stringify({ stock_quantity: quantity }),
      signal: AbortSignal.timeout(10_000),
    }));
    if (!response.ok) throw new WooInventoryRequestError(response.status);
  }

  return {
    async reserve(items: StockItem[]): Promise<void> {
      const products = await Promise.all(
        items.map(async (item) => ({
          item,
          product: await get(item.productId),
        })),
      );
      if (
        products.some(
          ({ item, product }) => (product.stock_quantity ?? 0) < item.quantity,
        )
      )
        throw new InsufficientStockError('WooCommerce stock is insufficient');

      const changed: Array<{ id: string; quantity: number }> = [];
      try {
        for (const { item, product: current } of products) {
          const quantity = (current.stock_quantity ?? 0) - item.quantity;
          await set(item.productId, quantity);
          changed.push({
            id: item.productId,
            quantity: current.stock_quantity ?? 0,
          });
        }
      } catch (error) {
        await Promise.all(changed.map(({ id, quantity }) => set(id, quantity)));
        throw error;
      }
    },
  };
}

function withDeadline<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const result = Promise.race([
    operation,
    new Promise<never>((_, reject) =>
      timer = setTimeout(
        () => reject(new Error('WooCommerce inventory request timed out')),
        10_000,
      ),
    ),
  ]);
  return result.finally(() => clearTimeout(timer));
}
