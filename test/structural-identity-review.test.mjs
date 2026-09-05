import assert from 'node:assert/strict';
import test from 'node:test';
import { access, readFile } from 'node:fs/promises';

import { WordPressIdentityService } from '../libs/identity/nest/src/wordpress/wordpress-identity.service.ts';

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
    new Response(
      JSON.stringify({ errors: [{ message: 'already registered' }] }),
      {
        status: 200,
        headers: { 'content-type': 'application/json' },
      },
    );
  try {
    const wordpress = new WordPressIdentityService({
      endpoint: 'http://wordpress',
      registrarIdentity: 'identity-registrar',
      siteToken: 'site-token',
    });
    await assert.rejects(
      wordpress.createCustomer({
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

test('AC-239: identity authentication uses sibling NestJS feature modules @spec:AC-239', async () => {
  const modules = [
    'libs/identity/nest/src/better-auth/better-auth.module.ts',
    'libs/identity/nest/src/oauth-issuer/oauth-issuer.module.ts',
    'libs/identity/nest/src/registration/registration.module.ts',
    'libs/identity/nest/src/wordpress/wordpress.module.ts',
  ];
  await Promise.all(modules.map((file) => access(file)));
  await assert.rejects(access('libs/identity/nest/src/auth'));
});

test('AC-240/AC-244: OAuth issuer and resource verification have explicit ownership @spec:AC-240 @spec:AC-244', async () => {
  const [entrypoint, identityModule, oauthResources, issuerModule, main] =
    await Promise.all([
      readFile('libs/identity/nest/src/index.ts', 'utf8'),
      readFile('libs/identity/nest/src/identity.module.ts', 'utf8'),
      readFile(
        'libs/identity/nest/src/oauth-issuer/oauth-resources.ts',
        'utf8',
      ),
      readFile(
        'libs/identity/nest/src/oauth-issuer/oauth-issuer.module.ts',
        'utf8',
      ),
      readFile('apps/identity-subgraph/src/main.ts', 'utf8'),
    ]);

  assert.doesNotMatch(
    entrypoint,
    /OAuthClient(?:Bootstrap|Provisioning)Service/,
  );
  assert.match(identityModule, /BetterAuthModule/);
  assert.match(identityModule, /OAuthIssuerModule/);
  assert.match(issuerModule, /OAuthClientProvisioningService/);
  assert.match(oauthResources, /OAUTH_RESOURCES/);
  assert.doesNotMatch(
    main,
    /OAuthClient(?:Bootstrap|Provisioning)Service|app\.get\(OAuthClient/,
  );
  await assert.rejects(access('libs/identity/nest/src/oauth'));
  await Promise.all([
    access('libs/identity/nest/src/better-auth/better-auth.error.ts'),
    access('libs/identity/nest/src/oauth-issuer/oauth.error.ts'),
    access('libs/identity/nest/src/registration/registration.error.ts'),
    access('libs/identity/nest/src/wordpress/wordpress.error.ts'),
  ]);
});
