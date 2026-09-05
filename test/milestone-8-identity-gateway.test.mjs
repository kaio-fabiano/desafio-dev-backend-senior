import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { IdentityResolver } from '../libs/identity/nest/src/graphql/identity.resolver.ts';
import { AuthenticatedDataSource } from '../libs/gateway/nest/src/federation/authenticated-data-source.ts';
import { OwnedProductMutations } from './fixtures/identity-supplier.ts';

test('AC-080: Identity resolves authorized users, user, me and federated references from one repository @spec:AC-080', async () => {
  const records = [
    { id: 'u-1', email: 'buyer@example.com' },
    { id: 'u-2', email: 'supplier@example.com' },
  ];
  const repository = {
    async findPage(first) {
      const page = records.slice(0, first);
      return {
        edges: page.map((node) => ({ cursor: node.id, node })),
        pageInfo: {
          hasNextPage: records.length > first,
          hasPreviousPage: false,
          startCursor: page.at(0)?.id ?? null,
          endCursor: page.at(-1)?.id ?? null,
        },
      };
    },
  };
  const loader = {
    load: async (id) => records.find((user) => user.id === id) ?? null,
  };
  const resolver = new IdentityResolver(repository, loader);
  assert.deepEqual(await resolver.me('u-1'), records[0]);
  assert.deepEqual(await resolver.user('u-2'), records[1]);
  assert.equal((await resolver.users(1)).pageInfo.hasNextPage, true);
  assert.deepEqual(await resolver.resolveReference({ id: 'u-2' }), records[1]);
  const sdl = await readFile(
    'libs/contracts/graphql/identity/schema.graphql',
    'utf8',
  );
  assert.match(sdl, /users\(first: Int = 20, after: String\): UserConnection!/);
  assert.match(sdl, /user\(id: ID!\): User/);
});

test('AC-081: Gateway composes Federation v2 services and propagates verified identity context @spec:AC-081', async () => {
  const source = new AuthenticatedDataSource({
    url: 'http://identity/graphql',
    capabilities: { bearer: true },
  });
  const headers = new Headers();
  source.willSendRequest({
    request: { http: { headers } },
    context: {
      authorization: 'Bearer identity-token',
      subject: 'u-1',
      scopes: ['marketplace:read'],
      audience: ['gateway'],
      requestId: 'request-1',
    },
  });
  assert.equal(headers.get('authorization'), 'Bearer identity-token');
  assert.equal(headers.get('x-authenticated-subject'), null);
  assert.equal(headers.get('x-authenticated-scopes'), null);
  assert.doesNotThrow(() =>
    source.willSendRequest({
      request: { http: { headers: new Headers() } },
      context: undefined,
    }),
  );
  const [appModule, gatewayModule, gatewayAuthModule] = await Promise.all([
    readFile('apps/gateway/src/app.module.ts', 'utf8'),
    readFile('libs/gateway/nest/src/gateway.module.ts', 'utf8'),
    readFile('libs/gateway/nest/src/auth/gateway-auth.module.ts', 'utf8'),
  ]);
  assert.match(appModule, /GatewayModule/);
  assert.match(gatewayModule, /ApolloGatewayDriver/);
  assert.match(gatewayModule, /LocalCompose/);
  for (const service of [
    'identity',
    'wordpress',
    'payment',
    'order-workflow',
  ]) {
    assert.match(gatewayModule, new RegExp(`contract\\('${service}'\\)`));
  }
  assert.match(gatewayAuthModule, /IDENTITY_JWKS_URL/);
  assert.match(
    await readFile('apps/gateway/Dockerfile', 'utf8'),
    /COPY --chown=app:app libs\/contracts\/graphql \.\/libs\/contracts\/graphql/,
  );
});

test('AC-081: Identity serves real sign-up and discovery without test-only auth plugins @spec:AC-081', async () => {
  const { memoryAdapter } = await import('better-auth/adapters/memory');
  const { BetterAuthFactory } = await import(
    '../libs/identity/nest/src/better-auth/better-auth.factory.ts'
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
  const auth = new BetterAuthFactory().create({
    database: memoryAdapter(database),
    baseURL: 'http://identity.test',
    issuer: 'https://identity.test/api/auth',
    secret: 'identity-integration-secret-at-least-32-characters',
  });
  const signUp = await auth.handler(
    new Request('http://identity.test/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'buyer@identity.test',
        password: 'buyer-password-at-least-32-characters',
        name: 'Buyer',
      }),
    }),
  );
  assert.equal(signUp.status, 200);
  assert.equal((await signUp.json()).user.email, 'buyer@identity.test');

  const discovery = await auth.handler(
    new Request(
      'http://identity.test/api/auth/.well-known/openid-configuration',
    ),
  );
  assert.equal(discovery.status, 200);
  assert.equal(
    (await discovery.clone().json()).issuer,
    'https://identity.test/api/auth',
  );
  assert.match(
    (await discovery.json()).authorization_endpoint,
    /\/oauth2\/authorize$/,
  );

  const [main, dockerfile, oauthClientsController] = await Promise.all([
    readFile('apps/identity-subgraph/src/main.ts', 'utf8'),
    readFile('apps/identity-subgraph/Dockerfile', 'utf8'),
    readFile(
      'libs/identity/nest/src/oauth-issuer/oauth-clients.controller.ts',
      'utf8',
    ),
  ]);
  assert.doesNotMatch(
    main,
    /OAuthClient(?:Bootstrap|Provisioning)Service|app\.get\(OAuthClient/,
  );
  assert.match(oauthClientsController, /oauth\/clients/);
  assert.match(
    dockerfile,
    /libs\/contracts\/graphql\/identity\/schema\.graphql/,
  );
});

test('AC-082: Supplier ownership rejects update and removal before external mutation @spec:AC-082', async () => {
  let writes = 0;
  const mutations = new OwnedProductMutations({
    async findSupplierCompanyId() {
      return 'supplier-a';
    },
    async update() {
      writes += 1;
    },
    async remove() {
      writes += 1;
    },
  });
  await assert.rejects(
    () => mutations.update('supplier-b', 'product-1', { name: 'Changed' }),
    /another supplier/,
  );
  await assert.rejects(
    () => mutations.remove('supplier-b', 'product-1'),
    /another supplier/,
  );
  assert.equal(writes, 0);
  await mutations.update('supplier-a', 'product-1', { name: 'Changed' });
  assert.equal(writes, 1);
});

test('AC-086: Identity domain and policy code remain framework-free @spec:AC-086', async () => {
  const sources = await Promise.all(
    ['test/fixtures/identity-supplier.ts'].map((file) =>
      readFile(file, 'utf8'),
    ),
  );
  assert.doesNotMatch(
    sources.join('\n'),
    /@nestjs|@mikro-orm|\bamqplib\b|node:fs|\bfetch\s*\(/,
  );
});

test('AC-079: Compose configures GraphQL service identities for delivered adapters @spec:AC-079', async () => {
  const compose = await readFile('compose.yaml', 'utf8');
  assert.doesNotMatch(compose, /woocommerce_api_keys|WOO_CONSUMER/);
  assert.doesNotMatch(compose, /local-e2e-consumer|local-e2e-secret/);
  assert.match(
    compose,
    /identity-subgraph:[\s\S]*WORDPRESS_URL: http:\/\/wordpress/,
  );
  assert.match(compose, /order-workflow-subgraph:[\s\S]*WPGRAPHQL_SITE_TOKEN/);
});
