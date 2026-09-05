import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { IdentityResolver } from '../libs/identity/nest/src/graphql/identity.resolver.ts';
import { UserLoader } from '../libs/identity/nest/src/graphql/user.loader.ts';

const records = [
  { id: 'user-1', email: 'one@example.com' },
  { id: 'user-2', email: 'two@example.com' },
  { id: 'user-3', email: 'three@example.com' },
];

function authWithCounter() {
  const calls = [];
  const repository = {
    async findByIds(ids) {
      calls.push({ ids });
      return records.filter(({ id }) => ids.includes(id));
    },
    async findPage(first, after) {
      calls.push({ after, first });
      const page = records
        .filter(({ id }) => !after || id > after)
        .slice(0, first);
      return {
        edges: page.map((node) => ({ cursor: Buffer.from(node.id).toString('base64url'), node })),
        pageInfo: {
          hasNextPage: records.length > page.length,
          hasPreviousPage: after !== undefined,
          startCursor: page[0] ? Buffer.from(page[0].id).toString('base64url') : null,
          endCursor: page.at(-1) ? Buffer.from(page.at(-1).id).toString('base64url') : null,
        },
      };
    },
  };
  return {
    repository,
    calls,
  };
}

test('AC-197: User pages expose complete Relay cursors and PageInfo @spec:AC-197', async () => {
  const { repository } = authWithCounter();
  const resolver = new IdentityResolver(repository, new UserLoader(repository));
  const first = await resolver.users(2, undefined);
  const second = await resolver.users(2, first.pageInfo.endCursor);

  assert.deepEqual(Object.keys(first.pageInfo).sort(), [
    'endCursor',
    'hasNextPage',
    'hasPreviousPage',
    'startCursor',
  ]);
  assert.equal(first.pageInfo.hasNextPage, true);
  assert.equal(first.pageInfo.hasPreviousPage, false);
  assert.equal(first.pageInfo.startCursor, first.edges[0].cursor);
  assert.equal(first.pageInfo.endCursor, first.edges[1].cursor);
  assert.equal(second.pageInfo.hasPreviousPage, true);
  assert.equal(second.edges[0].node.id, 'user-3');

  const schema = await readFile(
    'libs/contracts/graphql/identity/schema.graphql',
    'utf8',
  );
  assert.match(schema, /hasPreviousPage: Boolean!/);
  assert.match(schema, /startCursor: String/);
});

test('AC-198: User references batch and cache only within one request @spec:AC-198', async () => {
  const firstRequest = authWithCounter();
  const firstLoader = new UserLoader(firstRequest.repository);
  const [one, two, repeated] = await Promise.all([
    firstLoader.load('user-1'),
    firstLoader.load('user-2'),
    firstLoader.load('user-1'),
  ]);

  assert.equal(one?.id, 'user-1');
  assert.equal(two?.id, 'user-2');
  assert.strictEqual(repeated, one);
  assert.equal(firstRequest.calls.length, 1);
  assert.deepEqual(firstRequest.calls[0].ids, ['user-1', 'user-2']);

  const secondRequest = authWithCounter();
  await new UserLoader(secondRequest.repository).load('user-1');
  assert.equal(secondRequest.calls.length, 1);
});

test('AC-199: Production Identity references keep datasource calls constant @spec:AC-199', async () => {
  const request = authWithCounter();
  const resolver = new IdentityResolver(
    request.repository,
    new UserLoader(request.repository),
  );
  const resolved = await Promise.all([
    resolver.resolveReference({ id: 'user-1' }),
    resolver.resolveReference({ id: 'user-2' }),
    resolver.resolveReference({ id: 'user-3' }),
    resolver.user('user-1'),
    resolver.me('user-2'),
  ]);

  assert.deepEqual(
    resolved.map((user) => user?.id),
    ['user-1', 'user-2', 'user-3', 'user-1', 'user-2'],
  );
  assert.equal(
    request.calls.length,
    1,
    'one request must issue one batched user query',
  );

  const moduleSource = await readFile(
    'libs/identity/nest/src/identity.module.ts',
    'utf8',
  );
  const loaderSource = await readFile(
    'libs/identity/nest/src/graphql/user.loader.ts',
    'utf8',
  );
  assert.match(moduleSource, /UserLoader/);
  assert.match(loaderSource, /Injectable\(\{ scope: Scope\.REQUEST \}\)/);
});

test('AC-200: Commercial connections preserve Relay edges through federation @spec:AC-200', async () => {
  for (const path of [
    'libs/contracts/graphql/wordpress/schema.graphql',
    'apps/apollo-mcp/schema.graphql',
  ]) {
    const schema = await readFile(path, 'utf8');
    for (const type of ['Product', 'CartItem', 'Order', 'OrderLineItem']) {
      assert.match(
        schema,
        new RegExp(
          `type ${type}Connection \\{[\\s\\S]*edges: \\[${type}Edge!\\]!`,
        ),
      );
      assert.match(
        schema,
        new RegExp(
          `type ${type}Edge \\{[\\s\\S]*cursor: String![\\s\\S]*node: ${type}!`,
        ),
      );
    }
    for (const field of [
      'hasNextPage',
      'hasPreviousPage',
      'startCursor',
      'endCursor',
    ]) {
      assert.match(schema, new RegExp(`${field}:`));
    }
  }

  const journey = await readFile('apps/e2e/src/journey.ts', 'utf8');
  assert.match(journey, /products\(first: 20\) \{ edges \{ cursor node \{/);
  assert.doesNotMatch(journey, /products\(first: 20\) \{ nodes \{/);
});
