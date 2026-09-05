import type {
  WooCartSnapshot,
  WooCheckoutInput,
  WooCheckoutOrder,
  WooCheckoutPort,
} from './woo-checkout.port.ts';
type Fetch = typeof fetch;

const OPERATION_META_KEY = '_order_workflow_operation_reference';

export type WooGraphQLServiceCredentials = {
  serviceIdentity: string;
  siteToken: string;
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
  credentials: WooGraphQLServiceCredentials,
  request: Fetch = fetch,
): WooCheckoutPort {
  const pending = new Map<string, Promise<WooCheckoutOrder>>();

  async function execute<T>(
    input: WooCheckoutInput,
    query: string,
    variables: Record<string, unknown> = {},
    serviceHeaders: Record<string, string> = {},
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
        ...serviceHeaders,
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
    const authentication = await execute<{
      login?: { authToken?: string };
    }>(
      input,
      `mutation LoginOrderWorkflow($input: LoginInput!) {
        login(input: $input) { authToken }
      }`,
      {
        input: {
          identity: credentials.serviceIdentity,
          provider: 'SITETOKEN',
        },
      },
      { 'x-wpgraphql-site-token': credentials.siteToken },
    );
    const authToken = authentication.login?.authToken;
    if (!authToken) {
      throw new WooCheckoutRequestError(502, 'WooGraphQL login failed');
    }
    const data = await execute<{
      orders?: { nodes?: WooGraphQLOrder[] };
    }>(
      input,
      `query FindOrderByWorkflowReference($reference: String!) {
        orders(first: 2, where: { search: $reference }) {
          nodes {
            databaseId
            total(format: RAW)
            currency
            metaData { key value }
            lineItems(first: 100) {
              nodes { quantity product { node { databaseId } } }
            }
          }
        }
      }`,
      { reference: input.reference },
      { authorization: `Bearer ${authToken}` },
    );
    const orders = data.orders?.nodes;
    if (!Array.isArray(orders)) {
      throw new WooCheckoutRequestError(502, 'WooCommerce orders are invalid');
    }
    const matches = orders.filter(
      (order): order is WooGraphQLOrder =>
        isWooGraphQLOrder(order) &&
        order.metaData.some(
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
    return matches[0] ? graphqlOrder(matches[0]) : null;
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

type WooGraphQLOrder = {
  databaseId: number;
  total?: string;
  currency?: string;
  metaData: Array<{ key?: string; value?: string }>;
  lineItems: {
    nodes: Array<{
      quantity?: number;
      product?: { node?: { databaseId?: number } };
    }>;
  };
};

function isWooGraphQLOrder(value: unknown): value is WooGraphQLOrder {
  if (!value || typeof value !== 'object') return false;
  const order = value as Partial<WooGraphQLOrder>;
  return (
    Number.isSafeInteger(order.databaseId) &&
    Array.isArray(order.metaData) &&
    Array.isArray(order.lineItems?.nodes)
  );
}
function graphqlOrder(order: WooGraphQLOrder): WooCheckoutOrder {
  if (!Number.isSafeInteger(order.databaseId) || !order.databaseId) {
    throw new WooCheckoutRequestError(502, 'Stored order id is invalid');
  }
  return {
    id: String(order.databaseId),
    cartSnapshot: cartSnapshot(
      order.lineItems.nodes,
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
  if (items.length === 0) {
    throw new WooCheckoutRequestError(502, 'Cart items are invalid');
  }
  const normalizedItems = items.map((item) => {
    const id = Number(
      item.product?.node?.databaseId ?? item.product?.databaseId,
    );
    const quantity = Number(item.quantity);
    if (
      !Number.isSafeInteger(id) ||
      id < 1 ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1
    ) {
      throw new WooCheckoutRequestError(502, 'Cart item is invalid');
    }
    return { id, quantity };
  });
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new WooCheckoutRequestError(502, 'Cart currency is invalid');
  }
  return {
    items: normalizedItems,
    totals: {
      total_price: decimalMinorUnits(total, 2),
      currency_minor_unit: 2,
      currency_code: currency,
    },
  };
}

function decimalMinorUnits(value: string | undefined, scale: number): string {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value ?? '');
  if (!match) {
    throw new WooCheckoutRequestError(502, 'Cart total is invalid');
  }
  const amount =
    BigInt(match[1]) * 10n ** BigInt(scale) +
    BigInt((match[2] ?? '').padEnd(scale, '0'));
  if (amount <= 0n || amount > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new WooCheckoutRequestError(502, 'Cart total is invalid');
  }
  return String(amount);
}
