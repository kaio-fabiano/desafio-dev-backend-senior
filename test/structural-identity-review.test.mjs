import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { wordpressIdentityProvider } from '../libs/identity/nest/src/auth/registration.service.ts';

test('AC-122: Identity keeps one authorization authority @spec:AC-122', async () => {
  const [identityModule, resource] = await Promise.all([
    readFile('libs/identity/nest/src/identity.module.ts', 'utf8'),
    readFile(
      'libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.ts',
      'utf8',
    ),
  ]);
  assert.match(identityModule, /OAuthResourceModule\.register/);
  assert.match(resource, /verifyAccessTokenRequest/);
  assert.doesNotMatch(
    identityModule,
    /x-federation-secret|x-authenticated-subject|x-authenticated-scopes/,
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
