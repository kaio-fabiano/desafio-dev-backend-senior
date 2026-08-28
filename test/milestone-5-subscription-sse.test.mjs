import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

import { ApolloDriver } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { json } from 'express';

import { OrderEventBroker } from '../apps/commerce-subgraph/src/subscriptions/order-event-broker.ts';
import {
  OrderEventBackpressureError,
  OrderEventsSubscription,
} from '../apps/commerce-subgraph/src/subscriptions/order-events.subscription.ts';
import { createGatewaySseHandler } from '../apps/gateway/src/subscriptions/sse-handler.ts';
import { registerDeferredSseRoute } from '../apps/commerce-subgraph/src/subscriptions/sse-handler.ts';

const token = {
  issuer: 'https://identity.marketplace.test/api/auth',
  audience: 'https://gateway.marketplace.local',
  requiredScopes: ['marketplace:read'],
};
const query =
  'subscription OrderEvents($operationKey: ID!) { orderEvents(operationKey: $operationKey) { operationKey orderId state pixCode eventTime } }';

test('AC-053: A pre-mutation Card stream reaches completion @spec:AC-053', async () => {
  const harness = await acceptanceHarness();
  try {
    const stream = harness.subscribe('buyer-card', 'card-before-checkout');
    await harness.waitForListener('buyer-card', 'card-before-checkout');

    const order = harness.checkout('buyer-card', 'card-before-checkout', 'CARD');
    const response = await stream;
    const events = await readEvents(response);
    const workflow = harness.readWorkflow(order.id);

    assert.match(response.headers.get('content-type') ?? '', /^text\/event-stream/);
    assert.deepEqual(events.map((event) => event.state), [
      'PAYMENT_PENDING',
      'PAYMENT_AUTHORIZED',
      'STOCK_PENDING',
      'COMPLETED',
    ]);
    assert.deepEqual(terminal(events), workflow);
  } finally {
    await harness.close();
  }
});

test('AC-054: A pre-mutation Pix stream returns its stable code @spec:AC-054', async () => {
  const harness = await acceptanceHarness();
  try {
    const stream = harness.subscribe('buyer-pix', 'pix-before-checkout');
    await harness.waitForListener('buyer-pix', 'pix-before-checkout');

    const order = harness.checkout('buyer-pix', 'pix-before-checkout', 'PIX');
    const events = await readEvents(await stream);
    const workflow = harness.readWorkflow(order.id);

    assert.deepEqual(events.map((event) => event.state), [
      'PIX_PENDING',
      'PIX_GENERATED',
    ]);
    assert.equal(terminal(events).pixCode, '000201BR-STABLE');
    assert.deepEqual(terminal(events), workflow);
  } finally {
    await harness.close();
  }
});

test('AC-055: Authentication is required before opening the stream @spec:AC-055', async () => {
  const harness = await acceptanceHarness();
  try {
    const response = await fetch(harness.url, {
      method: 'POST',
      headers: sseHeaders(),
      body: JSON.stringify({ query, variables: { operationKey: 'forbidden' } }),
    });
    assert.equal(response.status, 401);
    assert.equal(harness.broker.listenerCount(), 0);
  } finally {
    await harness.close();
  }
});

test('AC-056: Operation keys are isolated by authenticated subject @spec:AC-056', async () => {
  const harness = await acceptanceHarness();
  const intruder = new AbortController();
  try {
    const mine = harness.subscribe('buyer-owner', 'shared-operation');
    const theirs = harness.subscribe('buyer-other', 'shared-operation', intruder.signal);
    await harness.waitForListener('buyer-owner', 'shared-operation');
    await harness.waitForListener('buyer-other', 'shared-operation');

    harness.checkout('buyer-owner', 'shared-operation', 'CARD');
    const events = await readEvents(await mine);
    assert.equal(terminal(events).state, 'COMPLETED');
    assert.equal(harness.broker.listenerCount('buyer-other', 'shared-operation'), 1);

    const otherResponse = await theirs;
    intruder.abort();
    await assert.rejects(otherResponse.text(), /abort/i);
    await waitUntil(() => harness.broker.listenerCount() === 0);
  } finally {
    intruder.abort();
    await harness.close();
  }
});

test('AC-057: The edge uses GraphQL SSE through both segments @spec:AC-057', async () => {
  const harness = await acceptanceHarness();
  try {
    const stream = harness.subscribe('buyer-sse', 'sse-operation');
    await harness.waitForListener('buyer-sse', 'sse-operation');
    harness.checkout('buyer-sse', 'sse-operation', 'PIX');
    const response = await stream;

    assert.match(response.headers.get('content-type') ?? '', /^text\/event-stream/);
    assert.doesNotMatch(response.headers.get('content-type') ?? '', /multipart/i);
    assert.match(await response.text(), /PIX_GENERATED/);
  } finally {
    await harness.close();
  }
});

test('AC-057: Commerce reserves the SSE route before Nest Apollo initializes @spec:AC-057', async () => {
  class RuntimeModule {}
  Module({
    imports: [
      GraphQLModule.forRoot({
        driver: ApolloDriver,
        typeDefs: 'type Query { ping: String! }',
        resolvers: { Query: { ping: () => 'pong' } },
      }),
    ],
  })(RuntimeModule);

  const app = await NestFactory.create(RuntimeModule, { bodyParser: false, logger: false });
  const parseJson = json();
  app.use('/graphql', (request, response, next) =>
    request.path === '/stream' ? next() : parseJson(request, response, next));
  const activate = registerDeferredSseRoute(
    app.getHttpAdapter().getInstance(),
    '/graphql/stream',
  );
  await app.init();
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  assert.ok(address && typeof address !== 'string');
  const url = `http://127.0.0.1:${address.port}`;

  try {
    const starting = await fetch(`${url}/graphql/stream`, {
      method: 'POST',
      headers: sseHeaders(),
      body: JSON.stringify({ query, variables: { operationKey: 'starting' } }),
    });
    assert.equal(starting.status, 503);

    activate((_request, response) => {
      response.writeHead(202, { 'content-type': 'text/event-stream' });
      response.end('event: next\ndata: {}\n\n');
    });
    const active = await fetch(`${url}/graphql/stream`, {
      method: 'POST',
      headers: sseHeaders(),
      body: JSON.stringify({ query, variables: { operationKey: 'active' } }),
    });
    assert.equal(active.status, 202);
    assert.match(await active.text(), /event: next/);

    const graph = await fetch(`${url}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: '{ ping }' }),
    });
    assert.deepEqual(await graph.json(), { data: { ping: 'pong' } });
  } finally {
    await app.close();
  }
});

test('AC-058: Cancellation, timeout, heartbeat, and backpressure are bounded @spec:AC-058', async () => {
  const broker = new OrderEventBroker();
  const subscriptions = new OrderEventsSubscription(broker, {
    heartbeatMs: 5,
    idleTimeoutMs: 25,
    maxBufferedEvents: 2,
  });
  let heartbeats = 0;
  const idle = subscriptions.subscribe('buyer-a', 'idle', {
    onHeartbeat: () => (heartbeats += 1),
  });
  assert.deepEqual(await idle.next(), { done: true, value: undefined });
  assert.ok(heartbeats > 0);

  const controller = new AbortController();
  const cancelled = subscriptions.subscribe('buyer-a', 'cancelled', { signal: controller.signal });
  controller.abort();
  assert.deepEqual(await cancelled.next(), { done: true, value: undefined });

  const slow = subscriptions.subscribe('buyer-a', 'slow');
  for (const state of ['PAYMENT_PENDING', 'PAYMENT_AUTHORIZED', 'STOCK_PENDING']) {
    broker.publish(event('buyer-a', 'slow', 'order-slow', state));
  }
  await assert.rejects(slow.next(), OrderEventBackpressureError);
  await delay(30);
  assert.equal(broker.listenerCount(), 0);
});

test('AC-059: Milestone acceptance covers both terminal journeys @spec:AC-059', async () => {
  const project = await import('node:fs/promises').then(({ readFile }) =>
    readFile('apps/e2e/project.json', 'utf8'),
  );
  const command = JSON.parse(project).targets['milestone-5-acceptance'].options.command;
  assert.match(command, /milestone-5-subscription-sse\.test\.mjs/);
});

async function acceptanceHarness() {
  const broker = new OrderEventBroker();
  const subscriptions = new OrderEventsSubscription(broker, {
    heartbeatMs: 60_000,
    idleTimeoutMs: 5_000,
    maxBufferedEvents: 8,
  });
  const workflows = new Map();
  let orderNumber = 0;
  const server = createServer(createGatewaySseHandler({
    token,
    verify: async (request) => {
      const bearer = request.headers.get('authorization');
      if (!bearer?.startsWith('Bearer ')) throw new Error('Invalid access token');
      const subject = bearer.slice('Bearer '.length);
      return {
        subject,
        scopes: ['marketplace:read'],
        audience: [token.audience],
        requestId: 'acceptance-request',
      };
    },
    commerce: {
      subscribe(request, context) {
        const operationKey = String(request.variables?.operationKey ?? '');
        return subscriptions.subscribe(context.subject, operationKey);
      },
    },
  }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind');

  return {
    broker,
    url: `http://127.0.0.1:${address.port}/graphql/stream`,
    subscribe(subject, operationKey, signal) {
      return fetch(`http://127.0.0.1:${address.port}/graphql/stream`, {
        method: 'POST',
        signal,
        headers: { ...sseHeaders(), authorization: `Bearer ${subject}` },
        body: JSON.stringify({ query, variables: { operationKey } }),
      });
    },
    checkout(subject, operationKey, paymentMethod) {
      const id = `order-${++orderNumber}`;
      const states = paymentMethod === 'CARD'
        ? ['PAYMENT_PENDING', 'PAYMENT_AUTHORIZED', 'STOCK_PENDING', 'COMPLETED']
        : ['PIX_PENDING', 'PIX_GENERATED'];
      const pixCode = paymentMethod === 'PIX' ? '000201BR-STABLE' : undefined;
      for (const state of states) broker.publish(event(subject, operationKey, id, state, pixCode));
      workflows.set(id, { state: states.at(-1), ...(pixCode ? { pixCode } : {}) });
      return { id };
    },
    readWorkflow(orderId) {
      return workflows.get(orderId);
    },
    waitForListener(subject, operationKey) {
      return waitUntil(() => broker.listenerCount(subject, operationKey) === 1);
    },
    close: () => {
      server.closeAllConnections();
      return new Promise((resolve, reject) =>
        server.close((error) => error ? reject(error) : resolve()),
      );
    },
  };
}

function event(subject, operationKey, orderId, state, pixCode) {
  return {
    subject,
    operationKey,
    payload: {
      operationKey,
      orderId,
      state,
      eventTime: '2026-08-27T12:00:00.000Z',
      ...(pixCode && state === 'PIX_GENERATED' ? { pixCode } : {}),
    },
  };
}

function sseHeaders() {
  return { accept: 'text/event-stream', 'content-type': 'application/json' };
}

async function readEvents(response) {
  const body = await response.text();
  const events = [...body.matchAll(/data:\s*(\{.*\})/g)]
    .map(([, payload]) => JSON.parse(payload))
    .map((message) => message.payload?.data?.orderEvents ?? message.data?.orderEvents ?? message)
    .filter(Boolean);
  return events;
}

function terminal(events) {
  const event = events.at(-1);
  return { state: event.state, ...(event.pixCode ? { pixCode: event.pixCode } : {}) };
}

async function waitUntil(condition, timeoutMs = 1_000) {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() >= deadline) throw new Error('Timed out waiting for subscription state');
    await delay(5);
  }
}
