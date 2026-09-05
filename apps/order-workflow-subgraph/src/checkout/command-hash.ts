import { createHash } from 'node:crypto';

import type { PaymentMethod } from './checkout.types.ts';

export interface CheckoutCommandData {
  paymentMethod: PaymentMethod;
  payerEmail: string;
  providerToken?: string;
  paymentMethodId?: string;
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
    payerEmail: command.payerEmail,
    providerToken: command.providerToken,
    paymentMethodId: command.paymentMethodId,
  });
}

export function checkoutWooReference(
  subject: string,
  operationKey: string,
): string {
  return `order-workflow-${sha256({ operationKey, subject })}`;
}
