import { createHash } from 'node:crypto';

export interface CheckoutCommandData {
  paymentMethod: string;
  cartSnapshot: unknown;
}

function canonicalize(value: unknown): unknown {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  throw new TypeError('Checkout commands must contain only JSON values');
}

function sha256(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(canonicalize(value)))
    .digest('hex');
}

export function checkoutCommandHash(command: CheckoutCommandData): string {
  return sha256({
    paymentMethod: command.paymentMethod,
    cartSnapshot: checkoutCart(command.cartSnapshot),
  });
}

function checkoutCart(snapshot: unknown): unknown {
  if (!snapshot || typeof snapshot !== 'object') return snapshot;
  const items = Reflect.get(snapshot, 'items');
  return {
    items: Array.isArray(items)
      ? items
          .map((item: unknown) => checkoutItem(item))
          .sort((left, right) => JSON.stringify(canonicalize(left)).localeCompare(JSON.stringify(canonicalize(right))))
      : items,
    totals: Reflect.get(snapshot, 'totals'),
  };
}

function checkoutItem(item: unknown): unknown {
  if (!item || typeof item !== 'object') return item;
  return {
    productId: Reflect.get(item, 'id') ?? Reflect.get(item, 'productId'),
    quantity: Reflect.get(item, 'quantity'),
    prices: Reflect.get(item, 'prices'),
    totals: Reflect.get(item, 'totals'),
  };
}

export function checkoutWooReference(
  subject: string,
  operationKey: string,
): string {
  return `commerce-checkout-${sha256({ operationKey, subject })}`;
}
