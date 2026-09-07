import { describe, expect, it } from 'vitest';

import { CommerceCookieAdapter } from '../infrastructure/http/commerce-cookie.adapter.ts';

describe('CommerceCookieAdapter', () => {
  it('retains only documented WooCommerce cart cookies', () => {
    expect(
      new CommerceCookieAdapter().allowlisted(
        'bad; analytics=x; woocommerce_cart_hash=h; ' +
          'woocommerce_items_in_cart=2; wp_woocommerce_session_store=a=b',
      ),
    ).toBe(
      'woocommerce_cart_hash=h; woocommerce_items_in_cart=2; ' +
        'wp_woocommerce_session_store=a=b',
    );
  });

  it('returns undefined when no allowlisted cookie is present', () => {
    const cookies = new CommerceCookieAdapter();
    expect(cookies.allowlisted(undefined)).toBeUndefined();
    expect(cookies.allowlisted('analytics=secret')).toBeUndefined();
  });
});
