import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CommerceResolver } from '../apps/commerce-subgraph/src/graphql/commerce.resolver.ts';
import { OrderEventBroker } from '../apps/commerce-subgraph/src/subscriptions/order-event-broker.ts';
import { OrderEventsSubscription } from '../apps/commerce-subgraph/src/subscriptions/order-events.subscription.ts';

const buyer = (subject) => ({
  subject,
  scopes: ['marketplace:read'],
  audience: ['gateway'],
  requestId: `request-${subject}`,
});

const transition = (subject, operationKey, state, extra = {}) => ({
  subject,
  operationKey,
  payload: {
    operationKey,
    orderId: 'order-1',
    state,
    eventTime: '2026-08-27T12:00:00.000Z',
    ...extra,
  },
});

function resolverHarness() {
  const broker = new OrderEventBroker();
  const subscriptions = new OrderEventsSubscription(broker, {
    heartbeatMs: 60_000,
    idleTimeoutMs: 60_000,
    maxBufferedEvents: 8,
  });
  let workflow = null;
  const resolver = new CommerceResolver(
    {},
    async () => ({}),
    async () => workflow,
    subscriptions,
  );
  return {
    broker,
    resolver,
    setWorkflow(value) {
      workflow = value;
    },
  };
}

test('AC-053: A pre-mutation Card stream reaches completion @spec:AC-053', async () => {
  const harness = resolverHarness();
  const stream = harness.resolver.orderEvents(
    buyer('buyer-a'),
    'card-operation',
  );

  for (const state of [
    'PAYMENT_PENDING',
    'PAYMENT_AUTHORIZED',
    'STOCK_PENDING',
    'COMPLETED',
  ]) {
    harness.broker.publish(transition('buyer-a', 'card-operation', state));
  }
  harness.setWorkflow({ state: 'COMPLETED' });

  const received = [];
  for await (const event of stream) received.push(event);

  assert.deepEqual(
    received.map(({ state }) => state),
    ['PAYMENT_PENDING', 'PAYMENT_AUTHORIZED', 'STOCK_PENDING', 'COMPLETED'],
  );
  assert.equal(
    received.at(-1).state,
    (await harness.resolver.workflow({ wooOrderId: 'order-1' })).state,
  );
});

test('AC-054: A pre-mutation Pix stream returns its stable code @spec:AC-054', async () => {
  const harness = resolverHarness();
  const stream = harness.resolver.orderEvents(
    buyer('buyer-a'),
    'pix-operation',
  );
  const pixCode = '000201BR-STABLE';

  harness.broker.publish(transition('buyer-a', 'pix-operation', 'PIX_PENDING'));
  harness.broker.publish(
    transition('buyer-a', 'pix-operation', 'PIX_GENERATED', { pixCode }),
  );
  harness.setWorkflow({ state: 'PIX_GENERATED', pixCode });

  const received = [];
  for await (const event of stream) received.push(event);
  const workflow = await harness.resolver.workflow({ wooOrderId: 'order-1' });

  assert.deepEqual(
    received.map(({ state }) => state),
    ['PIX_PENDING', 'PIX_GENERATED'],
  );
  assert.equal(received.at(-1).pixCode, pixCode);
  assert.deepEqual(
    { state: received.at(-1).state, pixCode: received.at(-1).pixCode },
    workflow,
  );
});

test('AC-056: Operation keys are isolated by authenticated subject @spec:AC-056', async () => {
  const broker = new OrderEventBroker();
  const subscriptions = new OrderEventsSubscription(broker, {
    heartbeatMs: 60_000,
    idleTimeoutMs: 60_000,
    maxBufferedEvents: 2,
  });
  const mine = subscriptions.subscribe('buyer-a', 'shared-key');
  const theirs = subscriptions.subscribe('buyer-b', 'shared-key');

  broker.publish(transition('buyer-a', 'shared-key', 'COMPLETED'));

  assert.equal((await mine.next()).value.state, 'COMPLETED');
  assert.deepEqual(await mine.next(), { done: true, value: undefined });
  assert.equal(broker.listenerCount('buyer-a', 'shared-key'), 0);
  assert.equal(broker.listenerCount('buyer-b', 'shared-key'), 1);
  await theirs.return();
  assert.equal(broker.listenerCount(), 0);
  assert.throws(() => subscriptions.subscribe('', 'shared-key'), /subject/);
});
