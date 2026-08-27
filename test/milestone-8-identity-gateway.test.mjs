import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import test from 'node:test';

import { IdentityResolver } from '../apps/identity-subgraph/src/graphql/identity.resolver.ts';
import {
  createIdentitySchema,
  executeIdentityOperation,
} from '../apps/identity-subgraph/src/graphql/identity-schema.ts';
import { OwnedProductMutations } from '../apps/identity-subgraph/src/supplier/owned-product-mutations.ts';
import { AuthenticatedDataSource } from '../apps/gateway/src/federation/authenticated-data-source.ts';
import { createIdentityAuth } from '../apps/identity-subgraph/src/auth/config.ts';
import { seedGatewayClient } from '../apps/identity-subgraph/src/auth/seed.ts';
import { toBetterAuthRequest } from '../apps/identity-subgraph/src/auth/http-bridge.ts';

test('AC-080: Identity resolves authorized users, user, me and federated references from one repository @spec:AC-080', async () => {
  const records = [
    { id: 'u-1', email: 'buyer@example.com' },
    { id: 'u-2', email: 'supplier@example.com' },
  ];
  const repository = {
    async findById(id) {
      return records.find((user) => user.id === id) ?? null;
    },
    async findPage({ first }) {
      const page = records.slice(0, first);
      return {
        edges: page.map((node) => ({ cursor: node.id, node })),
        pageInfo: {
          hasNextPage: records.length > first,
          endCursor: page.at(-1)?.id ?? null,
        },
      };
    },
  };
  const resolver = new IdentityResolver(repository);
  const context = { subject: 'u-1', scopes: ['marketplace:read'] };
  assert.deepEqual(await resolver.me(context), records[0]);
  assert.deepEqual(await resolver.user('u-2', context), records[1]);
  assert.equal(
    (await resolver.usersConnection({ first: 1 }, context)).pageInfo
      .hasNextPage,
    true,
  );
  assert.deepEqual(await resolver.resolveReference({ id: 'u-2' }), records[1]);
  const runtime = await createIdentitySchema(resolver);
  const result = await executeIdentityOperation(
    runtime,
    {
      query:
        '{ me { id } user(id: "u-2") { email } users(first: 1) { edges { node { id } } pageInfo { hasNextPage } } }',
    },
    context,
  );
  assert.deepEqual(JSON.parse(JSON.stringify(result.data)), {
    me: { id: 'u-1' },
    user: { email: 'supplier@example.com' },
    users: {
      edges: [{ node: { id: 'u-1' } }],
      pageInfo: { hasNextPage: true },
    },
  });
  await assert.rejects(
    async () => resolver.user('u-2', { subject: 'u-1', scopes: [] }),
    /access denied/,
  );
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
  });
  const headers = new Headers();
  source.willSendRequest({
    request: { http: { headers } },
    context: {
      subject: 'u-1',
      scopes: ['marketplace:read'],
      audience: ['gateway'],
      requestId: 'request-1',
    },
  });
  assert.equal(headers.get('x-authenticated-subject'), 'u-1');
  assert.equal(headers.get('x-authenticated-scopes'), 'marketplace:read');
  const gatewayModule = await readFile(
    'apps/gateway/src/app.module.ts',
    'utf8',
  );
  assert.match(gatewayModule, /ApolloGatewayDriver/);
  assert.match(gatewayModule, /IntrospectAndCompose/);
});

test('AC-081: Identity serves real sign-up, discovery and a PKCE client without test-only auth plugins @spec:AC-081', async () => {
  const { memoryAdapter } = await import('better-auth/adapters/memory');
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
  const auth = createIdentityAuth(memoryAdapter(database), {
    baseURL: 'http://identity.test',
    issuer: 'https://identity.test/api/auth',
    secret: 'identity-integration-secret-at-least-32-characters',
    seedAdminEmail: 'admin@identity.test',
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

  const client = await seedGatewayClient(auth, {
    email: 'admin@identity.test',
    password: 'admin-password-at-least-32-characters',
  });
  const stored = await (
    await auth.$context
  ).adapter.findOne({
    model: 'oauthClient',
    where: [{ field: 'clientId', value: client.clientId }],
  });
  assert.equal(stored.requirePKCE, true);
  assert.deepEqual(stored.grantTypes, ['authorization_code']);

  const config = await readFile(
    'apps/identity-subgraph/src/auth/config.ts',
    'utf8',
  );
  assert.doesNotMatch(config, /testUtils/);
  const [main, dockerfile] = await Promise.all([
    readFile('apps/identity-subgraph/src/main.ts', 'utf8'),
    readFile('apps/identity-subgraph/Dockerfile', 'utf8'),
  ]);
  assert.match(main, /bootstrapIdentityAuth/);
  assert.match(main, /\/oauth\/clients/);
  assert.match(
    dockerfile,
    /libs\/contracts\/graphql\/identity\/schema\.graphql/,
  );

  const incoming = Readable.from([
    JSON.stringify({ email: 'stream@identity.test', password: 'secret' }),
  ]);
  Object.assign(incoming, {
    method: 'POST',
    url: '/sign-up/email',
    originalUrl: '/api/auth/sign-up/email',
    headers: { 'content-type': 'application/json' },
  });
  const bridged = await toBetterAuthRequest(incoming, 'http://identity.test');
  assert.equal(bridged.url, 'http://identity.test/api/auth/sign-up/email');
  assert.deepEqual(await bridged.json(), {
    email: 'stream@identity.test',
    password: 'secret',
  });
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
    [
      'apps/identity-subgraph/src/graphql/identity.resolver.ts',
      'apps/identity-subgraph/src/supplier/product-ownership.ts',
      'apps/identity-subgraph/src/supplier/owned-product-mutations.ts',
    ].map((file) => readFile(file, 'utf8')),
  );
  assert.doesNotMatch(
    sources.join('\n'),
    /@nestjs|@mikro-orm|\bamqplib\b|node:fs|\bfetch\s*\(/,
  );
});
