import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { IdentityResolver } from '../apps/identity-subgraph/src/graphql/identity.resolver.ts';
import {
  createIdentitySchema,
  executeIdentityOperation,
} from '../apps/identity-subgraph/src/graphql/identity-schema.ts';
import { OwnedProductMutations } from '../apps/identity-subgraph/src/supplier/owned-product-mutations.ts';
import { AuthenticatedDataSource } from '../apps/gateway/src/federation/authenticated-data-source.ts';

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
