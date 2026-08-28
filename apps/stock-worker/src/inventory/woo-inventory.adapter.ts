import { resolve4 } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';

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
  const target = new URL(input);
  const originalHost = target.host;
  if (!isIP(target.hostname)) {
    const [address] = await resolve4(target.hostname);
    if (!address) throw new Error(`WooCommerce host did not resolve: ${target.hostname}`);
    target.hostname = address;
  }
  const body = typeof init.body === 'string' ? init.body : undefined;
  const transport = target.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const request = transport.request(target, {
      agent: false,
      method: init.method ?? 'GET',
      headers: {
        ...(init.headers as Record<string, string>),
        host: originalHost,
        connection: 'close',
        ...(body ? { 'content-length': Buffer.byteLength(body) } : {}),
      },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      response.once('end', () => {
        const responseBody = Buffer.concat(chunks).toString('utf8');
        const status = response.statusCode ?? 500;
        resolve({
          ok: status >= 200 && status < 300,
          status,
          json: async () => JSON.parse(responseBody),
        });
      });
      response.once('error', reject);
    });
    request.setTimeout(8_000, () =>
      request.destroy(new Error('WooCommerce inventory request timed out')));
    request.once('error', reject);
    if (body) request.write(body);
    request.end();
  });
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
