import { Buffer } from 'node:buffer';

import type {
  WooCartSnapshot,
  WooCheckoutInput,
  WooCheckoutOrder,
  WooCheckoutPort,
} from './woo-checkout.port.ts';

type Fetch = typeof fetch;

const OPERATION_META_KEY = '_order_workflow_operation_reference';

export type WooCheckoutServiceCredentials = {
  consumerKey: string;
  consumerSecret: string;
};

export class WooCheckoutRequestError extends Error {
  readonly code = 'WOO_CHECKOUT_REQUEST_FAILED';

  constructor(
    readonly status: number,
    message = 'WooGraphQL checkout failed',
  ) {
    super(`${message}: ${status}`);
  }
}

export function createWooCheckoutAdapter(
  endpoint: string,
  credentials: WooCheckoutServiceCredentials,
  request: Fetch = fetch,
): WooCheckoutPort {
  const pending = new Map<string, Promise<WooCheckoutOrder>>();

  async function execute<T>(
    input: WooCheckoutInput,
    query: string,
    variables: Record<string, unknown> = {},
  ): Promise<T> {
    const graphqlEndpoint = new URL('/graphql', endpoint);
    const response = await request(graphqlEndpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: graphqlEndpoint.origin,
        ...(input.session?.cartToken
          ? { 'cart-token': input.session.cartToken }
          : {}),
        ...(input.session?.wooSession
          ? { 'woocommerce-session': input.session.wooSession }
          : {}),
        ...(input.session?.cookie ? { cookie: input.session.cookie } : {}),
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!response.ok) throw new WooCheckoutRequestError(response.status);
    const payload = (await response.json()) as { data?: T; errors?: unknown[] };
    if (payload.errors?.length || !payload.data) {
      throw new WooCheckoutRequestError(502, 'WooGraphQL returned errors');
    }
    return payload.data;
  }

  async function currentCart(
    input: WooCheckoutInput,
  ): Promise<WooCartSnapshot> {
    const data = await execute<{
      cart?: {
        total?: string;
        contents?: {
          nodes?: Array<{
            quantity?: number;
            product?: { node?: { databaseId?: number } };
          }>;
        };
      };
    }>(
      input,
      `query OrderWorkflowCart {
      cart {
        total(format: RAW)
        contents { nodes { quantity product { node { databaseId } } } }
      }
    }`,
    );
    if (!data.cart) throw new WooCheckoutRequestError(502, 'Cart is missing');
    return cartSnapshot(
      data.cart.contents?.nodes ?? [],
      data.cart.total,
      'BRL',
    );
  }

  async function findByReference(
    input: WooCheckoutInput,
  ): Promise<WooCheckoutOrder | null> {
    const ordersEndpoint = new URL('/wp-json/wc/v3/orders', endpoint);
    ordersEndpoint.searchParams.set('search', input.reference);
    ordersEndpoint.searchParams.set('per_page', '2');
    const authorization = Buffer.from(
      `${credentials.consumerKey}:${credentials.consumerSecret}`,
    ).toString('base64');
    const response = await request(ordersEndpoint, {
      method: 'GET',
      headers: {
        authorization: `Basic ${authorization}`,
        ...(ordersEndpoint.protocol === 'http:'
          ? { 'x-forwarded-proto': 'https' }
          : {}),
      },
    });
    if (!response.ok) throw new WooCheckoutRequestError(response.status);
    const payload = (await response.json()) as unknown;
    if (!Array.isArray(payload)) {
      throw new WooCheckoutRequestError(502, 'WooCommerce orders are invalid');
    }
    const matches = payload.filter(
      (order): order is WooRestOrder =>
        isWooRestOrder(order) &&
        order.meta_data.some(
        ({ key, value }) =>
          key === OPERATION_META_KEY && value === input.reference,
      ),
    );
    if (matches.length > 1) {
      throw new WooCheckoutRequestError(
        502,
        'WooCommerce operation reference is not unique',
      );
    }
    return matches[0] ? restOrder(matches[0]) : null;
  }

  async function create(input: WooCheckoutInput): Promise<WooCheckoutOrder> {
    const snapshot = await currentCart(input);
    const data = await execute<{
      checkout?: { order?: { databaseId?: number } };
    }>(
      input,
      `mutation Checkout($input: CheckoutInput!) {
        checkout(input: $input) { order { databaseId } }
      }`,
      {
        input: {
          clientMutationId: input.reference,
          paymentMethod: 'cod',
          metaData: [{ key: OPERATION_META_KEY, value: input.reference }],
        },
      },
    );
    const id = data.checkout?.order?.databaseId;
    if (Number.isSafeInteger(id) && id) {
      return { id: String(id), cartSnapshot: snapshot };
    }
    const reconciled = await findByReference(input);
    if (!reconciled) {
      throw new WooCheckoutRequestError(502, 'Checkout order is missing');
    }
    return reconciled;
  }

  async function createOrFind(input: WooCheckoutInput) {
    const existing = pending.get(input.reference);
    if (existing) return existing;
    const operation = (async () =>
      (await findByReference(input)) ?? create(input))();
    pending.set(input.reference, operation);
    try {
      return await operation;
    } finally {
      if (pending.get(input.reference) === operation) {
        pending.delete(input.reference);
      }
    }
  }

  return { findByReference, createOrFind };
}

type WooRestOrder = {
  id: number;
  total?: string;
  currency?: string;
  meta_data: Array<{ key?: string; value?: string }>;
  line_items: Array<{ quantity?: number; product_id?: number }>;
};

function isWooRestOrder(value: unknown): value is WooRestOrder {
  if (!value || typeof value !== 'object') return false;
  const order = value as Partial<WooRestOrder>;
  return (
    Number.isSafeInteger(order.id) &&
    Array.isArray(order.meta_data) &&
    Array.isArray(order.line_items)
  );
}

function restOrder(order: WooRestOrder): WooCheckoutOrder {
  if (!Number.isSafeInteger(order.id) || !order.id) {
    throw new WooCheckoutRequestError(502, 'Stored order id is invalid');
  }
  return {
    id: String(order.id),
    cartSnapshot: cartSnapshot(
      order.line_items.map((item) => ({
        quantity: item.quantity,
        product: { databaseId: item.product_id },
      })),
      order.total,
      order.currency ?? 'BRL',
    ),
  };
}

function cartSnapshot(
  items: Array<{
    quantity?: number;
    product?: { node?: { databaseId?: number }; databaseId?: number };
  }>,
  total: string | undefined,
  currency: string,
): WooCartSnapshot {
  const amount = Number(total);
  return {
    items: items.map((item) => ({
      id: Number(item.product?.node?.databaseId ?? item.product?.databaseId),
      quantity: Number(item.quantity),
    })),
    totals: {
      total_price: Number.isFinite(amount)
        ? String(Math.round(amount * 100))
        : '',
      currency_minor_unit: 2,
      currency_code: currency,
    },
  };
}
