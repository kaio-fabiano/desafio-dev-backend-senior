import { describe, expect, it } from 'vitest';

import { IdentityUserVisibilityPolicy } from './identity-user-visibility.policy.ts';

describe('IdentityUserVisibilityPolicy', () => {
  it('allows marketplace self reads and administrative cross-user reads only @spec:AC-310', () => {
    expect(
      IdentityUserVisibilityPolicy.allows('buyer', 'buyer', [
        'marketplace:read',
      ]),
    ).toBe(true);
    expect(
      IdentityUserVisibilityPolicy.allows('buyer', 'admin', [
        'identity:users:read',
      ]),
    ).toBe(true);
    expect(
      IdentityUserVisibilityPolicy.allows('supplier', 'buyer', [
        'marketplace:read',
      ]),
    ).toBe(false);
    expect(
      IdentityUserVisibilityPolicy.allows('buyer', 'buyer', ['orders:read']),
    ).toBe(false);
  });
});
