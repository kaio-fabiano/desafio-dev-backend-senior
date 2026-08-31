import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { Scope } from '@nestjs/common';

import {
  COMMERCE_ENTITY_MANAGER,
  CommerceModule,
  commerceRequestContext,
  wooOrderGraphqlId,
} from '../apps/commerce-subgraph/src/graphql/commerce.module.ts';
import {
  CommerceResolver,
  CommerceUserResolver,
} from '../apps/commerce-subgraph/src/graphql/commerce.resolver.ts';

test('AC-083: Commerce presentation delegates checkout through configured runtime boundaries @spec:AC-083', async () => {
  const calls = [];
  const cart = {
    async get(subject) {
      calls.push(['cart.get', subject]);
      return { subject, items: [{ id: 42, quantity: 2 }] };
    },
    async addItem() {},
    async removeItem() {},
  };
  const resolver = new CommerceResolver(
    cart,
    async (subject, input) => {
      calls.push(['checkout', subject, input]);
      return { wooOrderId: '701' };
    },
    async (wooOrderId) => ({ wooOrderId, state: 'CREATED' }),
  );

  await resolver.checkout(
    { subject: 'buyer-1', scopes: [], audience: [], requestId: 'request-1' },
    { operationKey: 'operation-1', paymentMethod: 'CARD' },
  );
  assert.deepEqual(calls, [
    [
      'checkout',
      'buyer-1',
      { operationKey: 'operation-1', paymentMethod: 'CARD' },
    ],
  ]);

  const providers = Reflect.getMetadata('providers', CommerceModule);
  const entityManager = providers.find(
    (provider) => provider.provide === COMMERCE_ENTITY_MANAGER,
  );
  assert.equal(entityManager.scope, Scope.REQUEST);
  assert.ok(
    Reflect.getMetadata('imports', CommerceModule).some(
      (entry) => entry.module?.name === 'GraphQLModule',
    ),
  );
  assert.equal(
    commerceRequestContext({
      req: {
        headers: {
          'x-authenticated-subject': 'buyer-1',
          'x-request-id': 'request-1',
        },
      },
    }).subject,
    'buyer-1',
  );
  assert.equal(
    commerceRequestContext({ req: { headers: {} } }).subject,
    '',
  );
  assert.throws(
    () => resolver.checkout(
      { subject: '', scopes: [], audience: [], requestId: 'request-2' },
      { operationKey: 'operation-2', paymentMethod: 'PIX' },
    ),
    /Authenticated subject is required/,
  );

  const dockerfile = await readFile('apps/commerce-subgraph/Dockerfile', 'utf8');
  assert.match(
    dockerfile,
    /COPY --chown=app:app libs\/contracts\/graphql\/commerce\/schema\.graphql \.\/libs\/contracts\/graphql\/commerce\/schema\.graphql/,
  );
});

test('AC-083: User orders are private and loaded in one bounded page @spec:AC-083', async () => {
  assert.equal(wooOrderGraphqlId('701'), Buffer.from('post:701').toString('base64'));
  for (const invalid of ['', '0', '-1', '7x']) {
    assert.throws(() => wooOrderGraphqlId(invalid), /positive decimal integer/);
  }
  const calls = [];
  const resolver = new CommerceUserResolver({
    async findOrders(subject, first, offset) {
      calls.push({ subject, first, offset });
      return {
        orders: subject === 'buyer-1'
          ? [{ __typename: 'Order', id: '701', wooOrderId: '701', workflow: { state: 'COMPLETED' } }]
          : [],
        hasNextPage: false,
      };
    },
  });
  const context = { subject: 'buyer-1' };

  assert.deepEqual(await resolver.orders({ id: 'buyer-1' }, context, 20), {
    edges: [{ node: { __typename: 'Order', id: '701', wooOrderId: '701', workflow: { state: 'COMPLETED' } } }],
    pageInfo: { hasNextPage: false, endCursor: Buffer.from('1').toString('base64url') },
  });
  assert.deepEqual(calls, [{ subject: 'buyer-1', first: 20, offset: 0 }]);

  await assert.rejects(
    resolver.orders({ id: 'buyer-2' }, context, 20),
    /User orders are private/,
  );
  await assert.rejects(
    resolver.orders({ id: 'buyer-1' }, { subject: '' }, 20),
    /Authenticated subject is required/,
  );

  const empty = new CommerceUserResolver({
    async findOrders() {
      return { orders: [], hasNextPage: false };
    },
  });
  assert.deepEqual(
    await empty.orders({ id: 'buyer-empty' }, { subject: 'buyer-empty' }, 20),
    { edges: [], pageInfo: { hasNextPage: false, endCursor: null } },
  );
});

test('AC-086: Commerce domain and application code do not import frameworks or adapters @spec:AC-086', async () => {
  const boundaryFiles = [
    'apps/commerce-subgraph/src/cart/cart.service.ts',
    'apps/commerce-subgraph/src/checkout/checkout.service.ts',
    'apps/commerce-subgraph/src/saga/order-saga.ts',
    'apps/commerce-subgraph/src/subscriptions/order-events.subscription.ts',
  ];
  const forbidden =
    /from ['"](?:@nestjs|@mikro-orm|amqplib|node:fs)|\.adapter\.ts|\/persistence\//;

  for (const file of boundaryFiles) {
    assert.doesNotMatch(await readFile(file, 'utf8'), forbidden, file);
  }
});
