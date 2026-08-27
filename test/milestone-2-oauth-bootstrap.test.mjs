import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('AC-024: OAuth metadata and client seed are reproducible @spec:AC-024', async () => {
  const [{ memoryAdapter }, packageJson, project, { createIdentityAuth }, { seedGatewayClient }] =
    await Promise.all([
      import('better-auth/adapters/memory'),
      readFile('package.json', 'utf8').then(JSON.parse),
      readFile('apps/identity-subgraph/project.json', 'utf8').then(JSON.parse),
      import('../apps/identity-subgraph/src/auth/config.ts'),
      import('../apps/identity-subgraph/src/auth/seed.ts'),
    ]);

  assert.deepEqual(
    {
      oauthProvider: packageJson.dependencies['@better-auth/oauth-provider'],
      betterAuth: packageJson.dependencies['better-auth'],
      nestIntegration: packageJson.dependencies['@thallesp/nestjs-better-auth'],
      postgres: packageJson.dependencies.pg,
    },
    {
      oauthProvider: '1.7.1',
      betterAuth: '1.7.1',
      nestIntegration: '2.7.0',
      postgres: '8.23.0',
    },
  );
  assert.equal(
    project.targets.seed.options.command,
    'node --experimental-transform-types apps/identity-subgraph/src/auth/seed.ts',
  );

  const database = {
    user: [],
    session: [],
    account: [],
    verification: [],
    jwks: [],
    oauthClient: [],
    oauthAccessToken: [],
    oauthRefreshToken: [],
    oauthAuthorizationCode: [],
    oauthConsent: [],
    oauthResource: [],
    oauthClientResource: [],
  };
  const origin = 'http://localhost:3000';
  const issuer = `${origin}/api/auth`;
  const seedCredentials = {
    email: 'identity-seed@example.test',
    password: 'identity-seed-password-at-least-32-characters',
  };
  const auth = createIdentityAuth(memoryAdapter(database), {
    baseURL: origin,
    secret: 'identity-test-secret-at-least-32-characters',
    seedAdminEmail: seedCredentials.email,
  });

  const discoveryResponse = await auth.handler(
    new Request(`${issuer}/.well-known/openid-configuration`),
  );
  assert.equal(discoveryResponse.status, 200);
  const discovery = await discoveryResponse.json();
  assert.equal(discovery.issuer, issuer);
  assert.equal(discovery.jwks_uri, `${issuer}/jwks`);

  const jwksResponse = await auth.handler(new Request(discovery.jwks_uri));
  assert.equal(jwksResponse.status, 200);
  const jwks = await jwksResponse.json();
  assert.ok(jwks.keys.length > 0);

  const first = await seedGatewayClient(auth, seedCredentials);
  const second = await seedGatewayClient(auth, seedCredentials);
  const clients = await (await auth.$context).adapter.findMany({
    model: 'oauthClient',
    where: [{ field: 'softwareId', value: 'identity-gateway' }],
  });

  assert.equal(first.clientId, second.clientId);
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(clients.length, 1);
  assert.equal(clients[0].tokenEndpointAuthMethod, 'none');
  assert.deepEqual(clients[0].grantTypes, ['authorization_code']);
  assert.equal(clients[0].requirePKCE, true);
});
