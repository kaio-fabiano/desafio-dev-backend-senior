import assert from 'node:assert/strict';
import test from 'node:test';

import {
  wordpressIdentityProvider,
} from '../libs/identity/nest/src/auth/registration.service.ts';
import { trustedFederationContext } from '../libs/identity/nest/src/identity.module.ts';

test('AC-122: Identity keeps one authorization authority @spec:AC-122', async () => {
  assert.throws(
    () =>
      trustedFederationContext(
        {
          'x-authenticated-subject': 'victim',
          'x-authenticated-scopes': 'marketplace:read',
        },
        'internal-secret',
      ),
    /Unauthorized/,
  );
  assert.deepEqual(
    trustedFederationContext(
      {
        'x-federation-secret': 'internal-secret',
        'x-authenticated-subject': 'buyer-1',
        'x-authenticated-scopes': 'marketplace:read',
      },
      'internal-secret',
    ),
    { subject: 'buyer-1', scopes: ['marketplace:read'] },
  );

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify([{ id: 44 }]), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  try {
    const wordpress = wordpressIdentityProvider.useFactory();
    await assert.rejects(
      wordpress.createOrLink({
        email: 'existing@example.test',
        name: 'Attacker',
        password: 'secret',
      }),
      /WordPress identity already exists/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
