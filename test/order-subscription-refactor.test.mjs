import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { NestFactory } from '@nestjs/core';
import { GraphQLSchemaHost } from '@nestjs/graphql';

import { AppModule } from '../apps/wordpress-federation/src/app.module.ts';
import {
  GraphqlSseAdapter,
  OrderEventService,
  SubscriptionAuthGuard,
  SubscriptionsModule,
  WordPressFederationModule,
} from '../libs/wordpress/nest/src/index.ts';

const event = (subject, operationKey, state = 'PROCESSING') => ({
  subject,
  operationKey,
  payload: {
    operationKey,
    orderId: 'order-1',
    state,
    eventTime: '2026-08-28T12:00:00.000Z',
  },
});

test('AC-102: NestJS providers own authenticated order subscription filtering and cleanup @spec:AC-102', async () => {
  const auth = new SubscriptionAuthGuard();
  assert.throws(
    () => auth.authenticate({ headers: {} }),
    /authenticated subject/i,
  );
  assert.throws(
    () =>
      auth.authenticate({
        headers: { 'x-authenticated-subject': 'buyer-a' },
      }),
    /orders:read/,
  );
  assert.deepEqual(
    auth.authenticate({
      headers: {
        'x-authenticated-subject': 'buyer-a',
        'x-authenticated-scopes': 'marketplace:read orders:read',
        'x-request-id': 'request-1',
      },
    }),
    {
      subject: 'buyer-a',
      scopes: ['marketplace:read', 'orders:read'],
      requestId: 'request-1',
    },
  );

  const service = new OrderEventService();
  const mine = service.subscribe('buyer-a', 'operation-1');
  const anotherBuyer = service.subscribe('buyer-b', 'operation-1');

  service.publish(event('buyer-b', 'operation-1'));
  assert.deepEqual(await anotherBuyer.next(), {
    done: false,
    value: event('buyer-b', 'operation-1').payload,
  });
  assert.equal(service.listenerCount('buyer-a', 'operation-1'), 1);

  service.publish(event('buyer-a', 'operation-1', 'COMPLETED'));
  assert.deepEqual(await mine.next(), {
    done: false,
    value: event('buyer-a', 'operation-1', 'COMPLETED').payload,
  });
  assert.deepEqual(await mine.next(), { done: true, value: undefined });
  assert.equal(service.listenerCount('buyer-a', 'operation-1'), 0);

  await anotherBuyer.return();
  assert.equal(service.listenerCount(), 0);

  process.env.WPGRAPHQL_FEDERATION_SECRET = 'test-only-federation-secret';
  const app = await NestFactory.create(AppModule, { logger: false });
  try {
    await app.init();
    const schemaHost = app.get(GraphQLSchemaHost);
    const adapter = app.get(GraphqlSseAdapter);

    assert.strictEqual(adapter.executableSchema, schemaHost.schema);
    assert.equal(adapter.path, '/graphql/stream');
    assert.ok(schemaHost.schema.getSubscriptionType()?.getFields().orderEvents);
  } finally {
    await app.close();
  }
});

test('AC-095: order subscriptions are composed in WordPress without a gateway proxy @spec:AC-095', async () => {
  const wordpressImports = Reflect.getMetadata(
    'imports',
    WordPressFederationModule,
  );
  assert.ok(wordpressImports.includes(SubscriptionsModule));

  const sources = await Promise.all(
    [
      'libs/wordpress/nest/src/subscriptions/order-event.resolver.ts',
      'libs/wordpress/nest/src/subscriptions/order-event.service.ts',
      'libs/wordpress/nest/src/subscriptions/subscription-auth.guard.ts',
      'libs/wordpress/nest/src/subscriptions/graphql-sse.adapter.ts',
      'libs/wordpress/nest/src/subscriptions/subscriptions.module.ts',
    ].map((path) => readFile(path, 'utf8')),
  );
  assert.doesNotMatch(
    sources.join('\n'),
    /apps\/gateway|@apollo\/gateway|createClient|CommerceSubscriptionClient|subscription proxy/i,
  );
});
