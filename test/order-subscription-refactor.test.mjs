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
  WordPressCheckoutEventSource,
  WordPressFederationModule,
  WpGraphqlClientService,
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
  const request = (authorization = 'Bearer valid-token') => ({
    headers: { authorization, host: 'wordpress-federation' },
    method: 'POST',
    rawHeaders: ['authorization', authorization],
    url: '/graphql/stream',
  });
  const auth = (claims) =>
    new SubscriptionAuthGuard({
      audience: 'gateway',
      issuer: 'identity',
      jwksUrl: 'http://identity/jwks',
      verify: async (incoming) => {
        assert.equal(
          incoming.headers.get('authorization'),
          'Bearer valid-token',
        );
        return claims;
      },
    });
  await assert.rejects(
    () => auth({ scope: 'orders:read' }).authenticate(request()),
    /authenticated subject/i,
  );
  await assert.rejects(
    () => auth({ sub: 'buyer-a' }).authenticate(request()),
    /orders:read/,
  );
  assert.deepEqual(
    await auth({
      sub: 'buyer-a',
      scope: 'marketplace:read orders:read',
    }).authenticate({
      ...request(),
      headers: {
        authorization: 'Bearer valid-token',
        host: 'wordpress-federation',
        'x-request-id': 'request-1',
      },
    }),
    {
      subject: 'buyer-a',
      scopes: ['marketplace:read', 'orders:read'],
      requestId: 'request-1',
    },
  );
  await assert.rejects(
    () =>
      new SubscriptionAuthGuard({
        audience: 'gateway',
        issuer: 'identity',
        jwksUrl: 'http://identity/jwks',
        verify: async () => {
          throw new Error('bad signature');
        },
      }).authenticate({
        ...request(''),
        headers: {
          host: 'wordpress-federation',
          'x-authenticated-subject': 'forged-buyer',
          'x-authenticated-scopes': 'orders:read',
        },
        rawHeaders: [
          'x-authenticated-subject',
          'forged-buyer',
          'x-authenticated-scopes',
          'orders:read',
        ],
      }),
    /valid access token/i,
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

  const checkoutEvents = new WordPressCheckoutEventSource(service);
  const checkoutStream = service.subscribe('buyer-a', 'operation-checkout');
  const client = new WpGraphqlClientService({
    endpoint: 'http://wordpress/graphql',
    auth: { headersFor: (_operation, incoming) => new Headers(incoming) },
    checkoutEvents,
    request: async () =>
      Response.json({
        data: {
          checkout: {
            clientMutationId: 'operation-checkout',
            order: { id: 'order-2', status: 'COMPLETED' },
          },
        },
      }),
  });
  await client.execute(
    {
      query:
        'mutation Checkout($input: CheckoutInput!) { checkout(input: $input) { clientMutationId order { id status } } }',
      variables: { input: { clientMutationId: 'operation-checkout' } },
    },
    new Headers({ 'x-authenticated-subject': 'buyer-a' }),
  );
  const checkoutEvent = await checkoutStream.next();
  assert.deepEqual(checkoutEvent, {
    done: false,
    value: {
      operationKey: 'operation-checkout',
      orderId: 'order-2',
      state: 'COMPLETED',
      eventTime: checkoutEvent.value.eventTime,
    },
  });
  assert.match(checkoutEvent.value.eventTime, /^\d{4}-\d{2}-\d{2}T/);

  const pixStream = service.subscribe('buyer-a', 'operation-pix');
  const pixClient = new WpGraphqlClientService({
    endpoint: 'http://wordpress/graphql',
    auth: { headersFor: (_operation, incoming) => new Headers(incoming) },
    checkoutEvents,
    request: async () =>
      Response.json({
        data: {
          recordPixPaymentV1: {
            clientMutationId: 'operation-pix',
            order: { id: 'order-3' },
            paymentState: 'PIX_GENERATED',
            pixCode: 'PIX-stable',
          },
        },
      }),
  });
  await pixClient.execute(
    {
      query:
        'mutation RecordPix($input: RecordPixPaymentV1Input!) { recordPixPaymentV1(input: $input) { clientMutationId paymentState pixCode order { id } } }',
      variables: { input: { orderId: 3, pixCode: 'PIX-stable' } },
    },
    new Headers({ 'x-authenticated-subject': 'buyer-a' }),
  );
  const pixEvent = await pixStream.next();
  assert.deepEqual(pixEvent, {
    done: false,
    value: {
      operationKey: 'operation-pix',
      orderId: 'order-3',
      state: 'PIX_GENERATED',
      pixCode: 'PIX-stable',
      eventTime: pixEvent.value.eventTime,
    },
  });

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

test('AC-096: the WordPress subscription verifies the production issuer independently @spec:AC-096', async () => {
  const compose = await readFile('compose.yaml', 'utf8');
  const wordpress = compose.match(
    /^  wordpress-federation:\n([\s\S]*?)(?=^  [\w-]+:\n|^volumes:)/m,
  )?.[0] ?? '';
  assert.match(wordpress, /GATEWAY_AUDIENCE: https:\/\/gateway\.marketplace\.local/);
  assert.match(wordpress, /IDENTITY_JWKS_URL: http:\/\/identity\.localhost:3001\/api\/auth\/jwks/);
  assert.match(wordpress, /OAUTH_ISSUER: http:\/\/identity\.localhost:3001\/api\/auth/);
  assert.match(wordpress, /identity-subgraph:\n        condition: service_healthy/);
});

test('AC-102: the SSE route receives its protocol body before JSON middleware @spec:AC-102', async () => {
  const main = await readFile('apps/wordpress-federation/src/main.ts', 'utf8');
  assert.match(main, /NestFactory\.create\(AppModule, \{ bodyParser: false \}\)/);
  assert.match(main, /request\.path === '\/stream'/);
});
