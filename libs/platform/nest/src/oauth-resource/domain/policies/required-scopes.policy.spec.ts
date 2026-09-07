import { describe, expect, it } from 'vitest';

import { OAuthClaims } from '../value-objects/oauth-claims.ts';
import { RequiredScopesPolicy } from './required-scopes.policy.ts';

describe('RequiredScopesPolicy', () => {
  it('AC-264: requires every scope with case-sensitive matching @spec:AC-264', () => {
    const claims = OAuthClaims.from({
      scope: 'orders:read CART:WRITE',
      sub: 'buyer-1',
    });

    expect(RequiredScopesPolicy.allows(claims, ['orders:read'])).toBe(true);
    expect(RequiredScopesPolicy.allows(claims, [])).toBe(true);
    expect(
      RequiredScopesPolicy.allows(claims, ['orders:read', 'cart:write']),
    ).toBe(false);
  });
});
