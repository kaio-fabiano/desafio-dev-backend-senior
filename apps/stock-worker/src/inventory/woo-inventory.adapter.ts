import { spawn } from 'node:child_process';

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
  request = requestWooCommerceInChild,
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

async function requestWooCommerceInChild(input: URL, init: RequestInit = {}) {
  return new Promise<Pick<Response, 'json' | 'ok' | 'status'>>(
    (resolve, reject) => {
      const child = spawn(process.execPath, [
        '--experimental-transform-types',
        new URL('./woo-inventory.request.ts', import.meta.url).pathname,
      ], { stdio: ['pipe', 'pipe', 'pipe'] });
      const output: Buffer[] = [];
      const errors: Buffer[] = [];
      child.stdout.on('data', (chunk) => output.push(Buffer.from(chunk)));
      child.stderr.on('data', (chunk) => errors.push(Buffer.from(chunk)));
      const deadline = setTimeout(
        () => {
          child.kill('SIGKILL');
          reject(new Error('WooCommerce inventory request timed out'));
        },
        10_000,
      );
      const finish = () => clearTimeout(deadline);
      child.once('error', (error) => {
        finish();
        reject(error);
      });
      child.once('close', (code) => {
        finish();
        if (code !== 0) {
          reject(new Error(Buffer.concat(errors).toString('utf8') || `WooCommerce request process exited ${code}`));
          return;
        }
        const { status, body } = JSON.parse(Buffer.concat(output).toString('utf8')) as {
          status: number; body: string;
        };
        resolve({
          ok: status >= 200 && status < 300,
          status,
          json: async () => JSON.parse(body),
        });
      });
      child.stdin.end(JSON.stringify({
        url: input.toString(),
        method: init.method ?? 'GET',
        headers: init.headers,
        body: typeof init.body === 'string' ? init.body : undefined,
      }));
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
