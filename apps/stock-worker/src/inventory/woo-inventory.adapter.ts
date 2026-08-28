import { execFileSync } from 'node:child_process';

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
  const headers = Object.entries(init.headers as Record<string, string>)
    .map(([name, value]) => `header = ${JSON.stringify(`${name}: ${value}`)}`);
  const config = [
    'max-time = 8',
    `request = ${JSON.stringify(init.method ?? 'GET')}`,
    `url = ${JSON.stringify(input.toString())}`,
    ...headers,
    'header = "connection: close"',
    ...(typeof init.body === 'string'
      ? [`data = ${JSON.stringify(init.body)}`]
      : []),
    'write-out = "\\n%{http_code}"',
  ].join('\n');
  // ponytail: replace the synchronous curl boundary when the container Node
  // runtime no longer freezes its event loop while collecting child output.
  let result: string;
  try {
    result = execFileSync('curl', [
      '--silent', '--show-error', '--fail-with-body', '--config', '-',
    ], { input: config, timeout: 10_000, maxBuffer: 1_048_576, encoding: 'utf8' });
  } catch (error) {
    const output = Reflect.get(error as object, 'stdout');
    if (typeof output !== 'string' || !output.includes('\n')) throw error;
    result = output;
  }
  const boundary = result.lastIndexOf('\n');
  const body = result.slice(0, boundary);
  const status = Number(result.slice(boundary + 1));
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => JSON.parse(body),
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
