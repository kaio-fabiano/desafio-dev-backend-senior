import { describe, expect, it } from 'vitest';

import { checkoutCommandHash, checkoutWooReference } from './command-hash.ts';

describe('checkout command hashing', () => {
  it('preserves existing command and reference hashes @spec:AC-229', () => {
    expect(
      checkoutCommandHash({
        paymentMethod: 'CARD',
        payerEmail: 'buyer@example.test',
        providerToken: 'provider-token',
        paymentMethodId: 'visa',
      }),
    ).toBe('1969c55da45562315ec311647c6e9bd8fcfe324f77003ec5f4bae943f8bb4ef0');
    expect(
      checkoutCommandHash({
        payerEmail: 'buyer@example.test',
        paymentMethod: 'PIX',
      }),
    ).toBe('c893441e033887aecae751f5e686fb1382364cf9fe7bd1171a72ccf8e9dd0451');
    expect(checkoutWooReference('buyer-1', 'operation-1')).toBe(
      'order-workflow-55481d1f7ae76f7a8f235a304f5980deaa321a9c3d42d73430ccb34df8ac15f8',
    );
  });

  it('canonicalizes JSON values without adding a runtime dependency @spec:AC-229', () => {
    const left = checkoutCommandHash({
      paymentMethod: 'CARD',
      payerEmail: 'buyer@example.test',
      providerToken: undefined,
      paymentMethodId: 'visa',
    });
    const right = checkoutCommandHash({
      paymentMethodId: 'visa',
      payerEmail: 'buyer@example.test',
      paymentMethod: 'CARD',
    });

    expect(left).toBe(right);
    expect(() =>
      checkoutCommandHash({
        paymentMethod: 'CARD',
        payerEmail: 'buyer@example.test',
        providerToken: [1, true, null] as unknown as string,
      }),
    ).not.toThrow();
    expect(() =>
      checkoutCommandHash({
        paymentMethod: 'CARD',
        payerEmail: 'buyer@example.test',
        providerToken: (() => undefined) as unknown as string,
      }),
    ).toThrow(TypeError);
    expect(() =>
      checkoutCommandHash({
        paymentMethod: 'CARD',
        payerEmail: 'buyer@example.test',
        providerToken: Number.POSITIVE_INFINITY as unknown as string,
      }),
    ).toThrow(TypeError);
  });
});
