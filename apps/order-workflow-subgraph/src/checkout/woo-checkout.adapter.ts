import type {
  WooCartSnapshot,
  WooCheckoutInput,
  WooCheckoutOrder,
  WooCheckoutPort,
} from './woo-checkout.port.ts';

type Fetch = typeof fetch;

const OPERATION_META_KEY = '_order_workflow_operation_reference';

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
        'x-authenticated-subject': input.subject,
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
    let after: string | null = null;
    do {
      const data: OrderConnectionResponse =
        await execute<OrderConnectionResponse>(
          input,
          `query OrderWorkflowOrders($after: String) {
          customer {
            orders(first: 100, after: $after) {
              nodes {
                databaseId total currency metaData { key value }
                lineItems { nodes { quantity product { databaseId } } }
              }
              pageInfo { hasNextPage endCursor }
            }
          }
        }`,
          { after },
        );
      const connection: OrderConnection | undefined = data.customer?.orders;
      const order = connection?.nodes?.find((candidate) =>
        candidate.metaData?.some(
          ({ key, value }) =>
            key === OPERATION_META_KEY && value === input.reference,
        ),
      );
      if (order) return remoteOrder(order);
      after = connection?.pageInfo?.hasNextPage
        ? (connection.pageInfo.endCursor ?? null)
        : null;
    } while (after);
    return null;
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
          metaData: [{ key: OPERATION_META_KEY, value: input.reference }],
        },
      },
    );
    const id = data.checkout?.order?.databaseId;
    if (!Number.isSafeInteger(id) || !id) {
      throw new WooCheckoutRequestError(502, 'Checkout order is missing');
    }
    return { id: String(id), cartSnapshot: snapshot };
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

type RemoteOrder = {
  databaseId?: number;
  total?: string;
  currency?: string;
  metaData?: Array<{ key?: string; value?: string }>;
  lineItems?: {
    nodes?: Array<{
      quantity?: number;
      product?: { databaseId?: number };
    }>;
  };
};

type OrderConnection = {
  nodes?: Array<RemoteOrder>;
  pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
};

type OrderConnectionResponse = {
  customer?: { orders?: OrderConnection };
};

function remoteOrder(order: RemoteOrder): WooCheckoutOrder {
  if (!Number.isSafeInteger(order.databaseId) || !order.databaseId) {
    throw new WooCheckoutRequestError(502, 'Stored order id is invalid');
  }
  return {
    id: String(order.databaseId),
    cartSnapshot: cartSnapshot(
      order.lineItems?.nodes ?? [],
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
