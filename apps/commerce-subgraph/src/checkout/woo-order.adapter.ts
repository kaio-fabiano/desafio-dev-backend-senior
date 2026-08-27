type Fetch = typeof fetch;

export const WOO_OPERATION_REFERENCE_META_KEY = '_commerce_operation_reference';

export type WooOrder = Record<string, unknown> & {
  id: number;
  meta_data?: Array<{ key: string; value: unknown }>;
};

export type CreateWooOrder = {
  reference: string;
  order: Record<string, unknown> & {
    meta_data?: Array<{ key: string; value: unknown }>;
  };
};

export class WooOrderRequestError extends Error {
  readonly code = 'WOO_ORDER_REQUEST_FAILED';

  constructor(readonly status: number) {
    super(`WooCommerce order request failed: ${status}`);
  }
}

export class WooOrderReferenceError extends Error {
  readonly code = 'INVALID_WOO_ORDER_REFERENCE';
}

export function createWooOrderAdapter({
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
  };

  async function findByReference(reference: string): Promise<WooOrder | null> {
    assertReference(reference);
    for (let page = 1, pages = 1; page <= pages; page += 1) {
      const url = new URL('/wp-json/wc/v3/orders', endpoint);
      url.search = new URLSearchParams({
        page: String(page),
        per_page: '100',
        status: 'any',
      }).toString();
      const response = await request(url, { headers });
      if (!response.ok) throw new WooOrderRequestError(response.status);
      pages = Number(response.headers.get('x-wp-totalpages')) || 1;
      const orders = (await response.json()) as WooOrder[];
      const order = orders.find(({ meta_data = [] }) =>
        meta_data.some(
          ({ key, value }) =>
            key === WOO_OPERATION_REFERENCE_META_KEY && value === reference,
        ),
      );
      if (order) return order;
    }
    return null;
  }

  async function create({
    reference,
    order,
  }: CreateWooOrder): Promise<WooOrder> {
    assertReference(reference);
    const response = await request(new URL('/wp-json/wc/v3/orders', endpoint), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...order,
        meta_data: [
          ...(order.meta_data ?? []).filter(
            ({ key }) => key !== WOO_OPERATION_REFERENCE_META_KEY,
          ),
          { key: WOO_OPERATION_REFERENCE_META_KEY, value: reference },
        ],
      }),
    });
    if (!response.ok) throw new WooOrderRequestError(response.status);
    return (await response.json()) as WooOrder;
  }

  return {
    findByReference,
    create,
    async createOrFind(command: CreateWooOrder): Promise<WooOrder> {
      return (await findByReference(command.reference)) ?? create(command);
    },
  };
}

function assertReference(reference: string) {
  if (!reference.trim())
    throw new WooOrderReferenceError('WooCommerce order reference is required');
}
