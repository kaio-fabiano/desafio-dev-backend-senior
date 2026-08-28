import http from 'node:http';
import https from 'node:https';

type Fetch = (
  input: URL,
  init?: RequestInit,
) => Promise<Pick<Response, 'json' | 'ok' | 'status'>>;

export type StockItem = { productId: string; quantity: number };

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
    accept: 'application/json',
    'content-type': 'application/json',
    ...(new URL(endpoint).protocol === 'http:'
      ? { 'x-forwarded-proto': 'https' }
      : {}),
  };
  return {
    async reserve(items: StockItem[]): Promise<void> {
      const response = await withDeadline(request(
        new URL('/wp-json/marketplace/v1/inventory/reserve', endpoint),
        { method: 'POST', headers, body: JSON.stringify({ items }) },
      ));
      if (response.status === 409)
        throw new InsufficientStockError('WooCommerce stock is insufficient');
      if (!response.ok) throw new WooInventoryRequestError(response.status);
    },
  };
}

async function requestWooCommerce(input: URL, init: RequestInit = {}) {
  return new Promise<Pick<Response, 'json' | 'ok' | 'status'>>(
    (resolve, reject) => {
      const body = typeof init.body === 'string' ? init.body : undefined;
      const transport = input.protocol === 'https:' ? https : http;
      let activeResponse: import('node:http').IncomingMessage | undefined;
      const request = transport.request(
        input,
        {
          agent: Reflect.get(init, 'dispatcher') ?? false,
          method: init.method ?? 'GET',
          headers: {
            ...(init.headers as Record<string, string>),
            ...(body ? { 'content-length': Buffer.byteLength(body) } : {}),
          },
        },
        (response) => {
          activeResponse = response;
          const chunks: Buffer[] = [];
          response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
          response.once('end', () => {
            finish();
            const text = Buffer.concat(chunks).toString('utf8');
            const status = response.statusCode ?? 500;
            resolve({
              ok: status >= 200 && status < 300,
              status,
              json: async () => JSON.parse(text),
            });
          });
          response.once('error', fail);
        },
      );
      const deadline = setTimeout(
        () => {
          const error = new Error('WooCommerce inventory request timed out');
          activeResponse?.destroy(error);
          request.destroy(error);
        },
        10_000,
      );
      const finish = () => clearTimeout(deadline);
      const fail = (error: Error) => {
        finish();
        reject(error);
      };
      request.once('error', fail);
      if (body) request.write(body);
      request.end();
    },
  );
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
