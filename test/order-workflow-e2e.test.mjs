import assert from 'node:assert/strict';
import test from 'node:test';

import { OrderEventBroker } from '../apps/order-workflow-subgraph/src/subscriptions/order-event-broker.ts';
import { OrderEventsSubscription } from '../apps/order-workflow-subgraph/src/subscriptions/order-events.subscription.ts';

const options = {
  heartbeatMs: 1_000,
  idleTimeoutMs: 1_000,
  maxBufferedEvents: 4,
};

test('AC-146: subscription can precede checkout @spec:AC-146', async () => {
  const broker = new OrderEventBroker();
  const stream = new OrderEventsSubscription(
    broker,
    undefined,
    options,
  ).subscribe('buyer-1', 'operation-1');
  const next = stream.next();

  broker.publish({
    subject: 'buyer-1',
    operationKey: 'operation-1',
    payload: {
      operationKey: 'operation-1',
      orderId: 'order-1',
      state: 'COMPLETED',
      eventTime: new Date(0).toISOString(),
      version: 1,
    },
  });

  assert.equal((await next).value?.orderId, 'order-1');
  await stream.return();
});

test('AC-147: stream ownership prevents cross-user events @spec:AC-147', async () => {
  const broker = new OrderEventBroker();
  const controller = new AbortController();
  const stream = new OrderEventsSubscription(
    broker,
    undefined,
    options,
  ).subscribe('buyer-2', 'operation-1', { signal: controller.signal });
  const next = stream.next();

  broker.publish({
    subject: 'buyer-1',
    operationKey: 'operation-1',
    payload: {
      operationKey: 'operation-1',
      orderId: 'private-order',
      state: 'COMPLETED',
      eventTime: new Date(0).toISOString(),
      version: 1,
    },
  });
  controller.abort();

  assert.equal((await next).done, true);
});
