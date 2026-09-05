import { describe, expect, it } from 'vitest';

import { allowlistedCommerceCookies } from './gateway-context.ts';

describe('allowlistedCommerceCookies', () => {
  it('retains only documented WooCommerce cart cookies', () => {
    expect(
      allowlistedCommerceCookies(
        'bad; analytics=x; woocommerce_cart_hash=h; ' +
          'woocommerce_items_in_cart=2; wp_woocommerce_session_store=a=b',
      ),
    ).toBe(
      'woocommerce_cart_hash=h; woocommerce_items_in_cart=2; ' +
        'wp_woocommerce_session_store=a=b',
    );
  });

  it('returns undefined when no allowlisted cookie is present', () => {
    expect(allowlistedCommerceCookies(undefined)).toBeUndefined();
    expect(allowlistedCommerceCookies('analytics=secret')).toBeUndefined();
  });
});
