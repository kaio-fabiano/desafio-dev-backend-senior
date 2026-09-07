import { describe, expect, it } from 'vitest';

import { CommerceCookiePolicy } from './commerce-cookie-policy.ts';

describe('CommerceCookiePolicy', () => {
  it('retains only documented WooCommerce cart cookies', () => {
    expect(
      CommerceCookiePolicy.allowlisted(
        'bad; analytics=x; woocommerce_cart_hash=h; ' +
          'woocommerce_items_in_cart=2; wp_woocommerce_session_store=a=b',
      ),
    ).toBe(
      'woocommerce_cart_hash=h; woocommerce_items_in_cart=2; ' +
        'wp_woocommerce_session_store=a=b',
    );
  });

  it('returns undefined when no allowlisted cookie is present', () => {
    expect(CommerceCookiePolicy.allowlisted(undefined)).toBeUndefined();
    expect(CommerceCookiePolicy.allowlisted('analytics=secret')).toBeUndefined();
  });
});
