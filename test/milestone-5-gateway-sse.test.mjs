import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';

import { createCommerceSubscriptionClient } from '../apps/gateway/src/subscriptions/commerce-subscription.client.ts';
import { createGatewaySseHandler } from '../apps/gateway/src/subscriptions/sse-handler.ts';

const token = {
  issuer: 'https://identity.marketplace.test/api/auth',
  audience: 'https://gateway.marketplace.local',
  requiredScopes: ['marketplace:read'],
};
const context = {
  subject: 'buyer-a',
  scopes: ['marketplace:read'],
  audience: [token.audience],
  requestId: 'request-1',
};
const subscription = {
  query:
    'subscription Events($operationKey: ID!) { orderEvents(operationKey: $operationKey) { operationKey state } }',
  variables: { operationKey: 'operation-1' },
};

async function listen(handler) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Test server did not bind');
  return {
    url: `http://127.0.0.1:${address.port}/graphql/stream`,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

test('AC-055: Gateway authenticates before allocating a downstream stream @spec:AC-055', async () => {
  let allocations = 0;
  const server = await listen(
    createGatewaySseHandler({
      token,
      verify: async () => {
        throw new Error('Invalid access token');
      },
      commerce: {
        subscribe() {
          allocations += 1;
          throw new Error('must not run');
        },
      },
    }),
  );
  try {
    const response = await fetch(server.url, {
      method: 'POST',
      headers: {
        accept: 'text/event-stream',
        'content-type': 'application/json',
      },
      body: JSON.stringify(subscription),
    });
    assert.equal(response.status, 401);
    assert.equal(allocations, 0);
  } finally {
    await server.close();
  }
});

test('AC-057: Gateway returns GraphQL SSE and delegates the authenticated subject @spec:AC-057', async () => {
  let delegatedContext;
  const server = await listen(
    createGatewaySseHandler({
      token,
      verify: async () => context,
      commerce: {
        async *subscribe(_request, receivedContext) {
          delegatedContext = receivedContext;
          yield {
            data: {
              orderEvents: { operationKey: 'operation-1', state: 'COMPLETED' },
            },
          };
        },
      },
    }),
  );
  try {
    const response = await fetch(server.url, {
      method: 'POST',
      headers: {
        authorization: 'Bearer valid',
        accept: 'text/event-stream',
        'content-type': 'application/json',
      },
      body: JSON.stringify(subscription),
    });
    assert.match(
      response.headers.get('content-type') ?? '',
      /^text\/event-stream/,
    );
    assert.match(await response.text(), /COMPLETED/);
    assert.equal(delegatedContext.subject, 'buyer-a');
  } finally {
    await server.close();
  }
});

test('AC-058: Cancelling the edge iterator aborts and disposes Commerce resources @spec:AC-058', async () => {
  let downstreamReturned = 0;
  let clientDisposed = 0;
  let clientOptions;
  const downstream = {
    [Symbol.asyncIterator]() {
      return this;
    },
    async next() {
      return {
        done: false,
        value: { data: { orderEvents: { state: 'PROCESSING' } } },
      };
    },
    async return() {
      downstreamReturned += 1;
      return { done: true, value: undefined };
    },
  };
  const commerce = createCommerceSubscriptionClient({
    url: 'http://commerce.test/graphql/stream',
    createClient(options) {
      clientOptions = options;
      return {
        iterate: () => downstream,
        dispose: () => {
          clientDisposed += 1;
        },
      };
    },
  });
  const iterator = commerce.subscribe(subscription, context);
  await iterator.next();
  await iterator.return();

  assert.equal(clientOptions.headers['x-authenticated-subject'], 'buyer-a');
  assert.equal(clientOptions.singleConnection, false);
  assert.equal(downstreamReturned, 1);
  assert.equal(clientDisposed, 1);
});
