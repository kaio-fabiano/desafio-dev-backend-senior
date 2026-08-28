import type { WooCart, WooCartPort } from './woo-cart.port.ts';

type Fetch = typeof fetch;

export class WooCartMutationError extends Error {
  readonly code = 'WOO_CART_MUTATION_FAILED';

  constructor(readonly status: number) {
    super(`WooCommerce cart mutation failed: ${status}`);
  }
}

export class WooCartTokenError extends Error {
  readonly code = 'WOO_CART_TOKEN_MISSING';
}

export class WooCartItemNotFoundError extends Error {
  readonly code = 'WOO_CART_ITEM_NOT_FOUND';
}

export function createWooCartAdapter(
  endpoint: string,
  request: Fetch = fetch,
): WooCartPort {
  const tokens = new Map<string, string>();
  const bootstraps = new Map<string, Promise<WooCart>>();

  function cart(response: Response, subject: string): Promise<WooCart> {
    return response.json().then((body) => ({
      ...(body as Record<string, unknown>),
      id: subject,
      subject,
    }));
  }

  function rememberToken(subject: string, response: Response) {
    const token = response.headers.get('cart-token');
    if (token) tokens.set(subject, token);
    return token;
  }

  function forgetToken(subject: string, token: string) {
    if (tokens.get(subject) === token) tokens.delete(subject);
  }

  async function bootstrap(subject: string): Promise<WooCart> {
    const pending = bootstraps.get(subject);
    if (pending) return pending;

    const requestCart = (async () => {
      const response = await request(
        new URL('/wp-json/wc/store/v1/cart', endpoint),
        { headers: { 'x-authenticated-subject': subject } },
      );
      if (!response.ok) throw new WooCartMutationError(response.status);
      if (!rememberToken(subject, response)) {
        throw new WooCartTokenError(
          'WooCommerce did not return a Cart-Token header',
        );
      }
      return cart(response, subject);
    })();

    bootstraps.set(subject, requestCart);
    try {
      return await requestCart;
    } finally {
      if (bootstraps.get(subject) === requestCart) bootstraps.delete(subject);
    }
  }

  async function tokenFor(subject: string) {
    const token = tokens.get(subject);
    if (token) return token;
    await bootstrap(subject);
    const initialized = tokens.get(subject);
    if (!initialized) {
      throw new WooCartTokenError('WooCommerce Cart-Token was not retained');
    }
    return initialized;
  }

  async function mutate(
    path: string,
    subject: string,
    body: Record<string, number | string>,
  ) {
    const token = await tokenFor(subject);
    const response = await request(
      new URL(`/wp-json/wc/store/v1/cart/${path}`, endpoint),
      {
        method: 'POST',
        headers: {
          'cart-token': token,
          'content-type': 'application/json',
          'x-authenticated-subject': subject,
        },
        body: JSON.stringify(body),
      },
    );
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        forgetToken(subject, token);
      }
      throw new WooCartMutationError(response.status);
    }
    rememberToken(subject, response);
    return cart(response, subject);
  }

  async function get(subject: string) {
    const token = tokens.get(subject);
    if (!token) return bootstrap(subject);

    const response = await request(
      new URL('/wp-json/wc/store/v1/cart', endpoint),
      {
        headers: {
          'cart-token': token,
          'x-authenticated-subject': subject,
        },
      },
    );
    if (response.status === 401 || response.status === 403) {
      forgetToken(subject, token);
      return bootstrap(subject);
    }
    if (!response.ok) throw new WooCartMutationError(response.status);
    rememberToken(subject, response);
    return cart(response, subject);
  }

  return {
    get,
    addItem: (subject, input) =>
      mutate('add-item', subject, {
        id: input.productId,
        quantity: input.quantity,
      }),
    async removeItem(subject, input) {
      const current = await get(subject);
      const item = Array.isArray(current.items)
        ? current.items.find(
            (candidate: unknown) =>
              candidate !== null &&
              typeof candidate === 'object' &&
              (String(Reflect.get(candidate, 'id')) === input.itemKey ||
                Reflect.get(candidate, 'key') === input.itemKey),
          )
        : undefined;
      if (!item) {
        throw new WooCartItemNotFoundError(
          `WooCommerce cart item ${input.itemKey} was not found`,
        );
      }
      const key = String(Reflect.get(item, 'key'));
      const remaining = Number(Reflect.get(item, 'quantity')) - input.quantity;
      return remaining > 0
        ? mutate('update-item', subject, { key, quantity: remaining })
        : mutate('remove-item', subject, { key });
    },
  };
}
