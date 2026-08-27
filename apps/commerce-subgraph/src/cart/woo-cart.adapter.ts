import type {
  AddCartItem,
  RemoveCartItem,
  WooCart,
  WooCartPort,
} from './woo-cart.port.ts';

type Fetch = typeof fetch;

export class WooCartMutationError extends Error {
  readonly code = 'WOO_CART_MUTATION_FAILED';

  constructor(readonly status: number) {
    super(`WooCommerce cart mutation failed: ${status}`);
  }
}

export function createWooCartAdapter(
  endpoint: string,
  request: Fetch = fetch,
): WooCartPort {
  async function mutate(
    path: string,
    subject: string,
    input: AddCartItem | RemoveCartItem,
  ) {
    const response = await request(
      new URL(`/wp-json/wc/store/v1/cart/${path}`, endpoint),
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-authenticated-subject': subject,
        },
        body: JSON.stringify(
          'productId' in input
            ? { id: input.productId, quantity: input.quantity }
            : { key: input.itemKey, quantity: input.quantity },
        ),
      },
    );
    if (!response.ok) throw new WooCartMutationError(response.status);
    return {
      ...((await response.json()) as Record<string, unknown>),
      subject,
    } as WooCart;
  }

  return {
    async get(subject) {
      const response = await request(
        new URL('/wp-json/wc/store/v1/cart', endpoint),
        {
          headers: { 'x-authenticated-subject': subject },
        },
      );
      if (!response.ok) throw new WooCartMutationError(response.status);
      return {
        ...((await response.json()) as Record<string, unknown>),
        subject,
      };
    },
    addItem: (subject, input) => mutate('add-item', subject, input),
    removeItem: (subject, input) => mutate('remove-item', subject, input),
  };
}
