import http from 'node:http';
import https from 'node:https';

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
  request = requestWooCommerce,
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
  const product = (id: string) =>
    new URL(`/wp-json/wc/v3/products/${id}`, endpoint);

  async function get(id: string): Promise<WooProduct> {
    const response = await request(product(id), { headers });
    if (!response.ok) throw new WooInventoryRequestError(response.status);
    return (await response.json()) as WooProduct;
  }

  async function set(id: string, quantity: number): Promise<void> {
    const response = await request(product(id), {
      method: 'PUT',
      headers,
      body: JSON.stringify({ stock_quantity: quantity }),
    });
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

async function requestWooCommerce(input: URL, init: RequestInit = {}) {
  return new Promise<Pick<Response, 'json' | 'ok' | 'status'>>(
    (resolve, reject) => {
      const transport = input.protocol === 'https:' ? https : http;
      const request = transport.request(
        input,
        { method: init.method ?? 'GET', headers: init.headers },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          response.once('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            const status = response.statusCode ?? 500;
            resolve({
              ok: status >= 200 && status < 300,
              status,
              json: async () => JSON.parse(body),
            });
          });
        },
      );
      request.setTimeout(10_000, () =>
        request.destroy(new Error('WooCommerce inventory request timed out')),
      );
      request.once('error', reject);
      if (init.body) request.write(init.body);
      request.end();
    },
  );
}
