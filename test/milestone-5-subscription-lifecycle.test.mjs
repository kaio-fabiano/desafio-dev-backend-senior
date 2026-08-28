import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';

import { OrderEventBroker } from '../apps/commerce-subgraph/src/subscriptions/order-event-broker.ts';
import {
  OrderEventBackpressureError,
  OrderEventsSubscription,
} from '../apps/commerce-subgraph/src/subscriptions/order-events.subscription.ts';

const transition = (state) => ({
  subject: 'buyer-a',
  operationKey: 'operation-1',
  payload: {
    operationKey: 'operation-1',
    orderId: 'order-1',
    state,
    eventTime: '2026-08-27T12:00:00.000Z',
  },
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
  assert.equal(broker.listenerCount('buyer-a', 'idle'), 0);

  const controller = new AbortController();
  const cancelled = subscriptions.subscribe('buyer-a', 'cancelled', {
    signal: controller.signal,
  });
  controller.abort();
  assert.deepEqual(await cancelled.next(), { done: true, value: undefined });
  assert.equal(broker.listenerCount('buyer-a', 'cancelled'), 0);

  const slow = subscriptions.subscribe('buyer-a', 'operation-1');
  broker.publish(transition('PAYMENT_PENDING'));
  broker.publish(transition('PAYMENT_AUTHORIZED'));
  broker.publish(transition('STOCK_PENDING'));
  await assert.rejects(slow.next(), OrderEventBackpressureError);
  assert.equal(broker.listenerCount('buyer-a', 'operation-1'), 0);

  await delay(30);
  assert.equal(broker.listenerCount(), 0);
});

test('AC-057: a transition committed during subscription setup is replayed @spec:AC-057', async () => {
  const broker = new OrderEventBroker();
  broker.publish(transition('COMPLETED'));
  const subscriptions = new OrderEventsSubscription(broker);

  const events = subscriptions.subscribe('buyer-a', 'operation-1');
  assert.deepEqual((await events.next()).value, transition('COMPLETED').payload);
  await events.return();
});
