type Fetch = typeof fetch;

export const WOO_OPERATION_REFERENCE_META_KEY = '_commerce_operation_reference';

export type WooOrder = Record<string, unknown> & {
  id: string;
  meta_data?: Array<{ key: string; value: unknown }>;
};

export type CreateWooOrder = {
  reference: string;
  cartSnapshot?: unknown;
  paymentMethod?: string;
  order?: Record<string, unknown> & {
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
    ...(new URL(endpoint).protocol === 'http:'
      ? { 'x-forwarded-proto': 'https' }
      : {}),
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
      const orders = (await response.json()) as Array<Omit<WooOrder, 'id'> & { id: string | number }>;
      const order = orders.find(({ meta_data = [] }) =>
        meta_data.some(
          ({ key, value }) =>
            key === WOO_OPERATION_REFERENCE_META_KEY && value === reference,
        ),
      );
      if (order) return { ...order, id: String(order.id) };
    }
    return null;
  }

  async function create({
    reference,
    order = {},
    cartSnapshot,
    paymentMethod,
  }: CreateWooOrder): Promise<WooOrder> {
    assertReference(reference);
    const response = await request(new URL('/wp-json/wc/v3/orders', endpoint), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...order,
        ...(cartSnapshot && typeof cartSnapshot === 'object'
          ? {
              line_items: wooLineItems(cartSnapshot),
              payment_method: paymentMethod,
            }
          : {}),
        meta_data: [
          ...(order.meta_data ?? []).filter(
            ({ key }) => key !== WOO_OPERATION_REFERENCE_META_KEY,
          ),
          { key: WOO_OPERATION_REFERENCE_META_KEY, value: reference },
        ],
      }),
    });
    if (!response.ok) throw new WooOrderRequestError(response.status);
    const created = (await response.json()) as Omit<WooOrder, 'id'> & {
      id: string | number;
    };
    return { ...created, id: String(created.id) };
  }

  return {
    findByReference,
    create,
    async createOrFind(command: CreateWooOrder): Promise<WooOrder> {
      return (await findByReference(command.reference)) ?? create(command);
    },
  };
}

function wooLineItems(
  cartSnapshot: object,
): Array<{ product_id: number; quantity: number }> {
  const items = Reflect.get(cartSnapshot, 'items');
  if (!Array.isArray(items)) return [];
  return items.map((item: unknown) => {
    if (!item || typeof item !== 'object')
      throw new TypeError('Cart item is invalid');
    const id = Number(Reflect.get(item, 'id'));
    const quantity = Number(Reflect.get(item, 'quantity'));
    if (
      !Number.isSafeInteger(id) ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1
    ) {
      throw new TypeError('Cart item is invalid');
    }
    return { product_id: id, quantity };
  });
}

function assertReference(reference: string) {
  if (!reference.trim())
    throw new WooOrderReferenceError('WooCommerce order reference is required');
}
