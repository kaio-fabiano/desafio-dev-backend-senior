import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OrderEventConsumer } from '../apps/commerce-subgraph/src/saga/order-event.consumer.ts';
import { OrderSaga, OrderWorkflowState } from '../apps/commerce-subgraph/src/saga/order-saga.ts';
import { OrderTransitionPublisher } from '../apps/commerce-subgraph/src/subscriptions/order-transition.publisher.ts';

test('AC-053: committed Card transitions are published in workflow order @spec:AC-053', async () => {
  const { consumer, database, events } = harness(OrderWorkflowState.PaymentPending);

  const result = await consumer.consume(sagaEvent('card-1', 'payment.authorized', {
    orderId: 'order-1',
    paymentId: 'payment-1',
  }));

  assert.equal(result.outcome, 'applied');
  assert.equal(database.committed, true);
  assert.deepEqual(events.map(({ payload }) => payload.state), [
    OrderWorkflowState.PaymentAuthorized,
    OrderWorkflowState.StockPending,
  ]);
  assert.ok(events.every((event) => event.subject === 'buyer-1'));
  assert.ok(events.every((event) => event.operationKey === 'operation-1'));
});

test('AC-054: Pix publication contains the stable code and skips duplicate deliveries @spec:AC-054', async () => {
  const { consumer, events } = harness(OrderWorkflowState.Created);
  const generated = sagaEvent('pix-1', 'payment.pix-generated', {
    orderId: 'order-1',
    paymentId: 'payment-1',
    pixCode: '000201BR-STABLE',
  });

  await consumer.consume(generated);
  const duplicate = await consumer.consume(generated);

  assert.equal(duplicate.outcome, 'duplicate');
  assert.deepEqual(events.map(({ payload }) => payload.state), [
    OrderWorkflowState.PixPending,
    OrderWorkflowState.PixGenerated,
  ]);
  assert.equal(events.at(-1).payload.pixCode, '000201BR-STABLE');
  assert.equal(events.length, 2);
});

test('AC-053: ignored and rolled-back transitions are never published @spec:AC-053', async () => {
  const ignored = harness(OrderWorkflowState.Completed);
  await ignored.consumer.consume(sagaEvent('ignored-1', 'stock.reserved', {
    orderId: 'order-1',
    reservationId: 'reservation-1',
  }));
  assert.deepEqual(ignored.events, []);

  const rolledBack = harness(OrderWorkflowState.PaymentPending, true);
  await assert.rejects(
    rolledBack.consumer.consume(sagaEvent('rollback-1', 'payment.authorized', {
      orderId: 'order-1',
      paymentId: 'payment-1',
    })),
    /commit failed/,
  );
  assert.deepEqual(rolledBack.events, []);
});

function harness(initialState, failCommit = false) {
  const events = [];
  const seen = new Set();
  const database = { committed: false };
  const workflow = {
    id: 'workflow-1',
    wooOrderId: 'order-1',
    state: initialState,
    operationKey: 'operation-1',
    subject: 'buyer-1',
  };
  const entityManager = {
    async transactional(callback) {
      const result = await callback({});
      if (failCommit) throw new Error('commit failed');
      database.committed = true;
      return result;
    },
  };
  const inbox = {
    async claim(_transaction, eventId) {
      if (seen.has(eventId)) return false;
      seen.add(eventId);
      return true;
    },
    async complete() {},
  };
  const workflows = {
    async findForUpdate() { return workflow; },
    async apply(_transaction, current, transition) {
      current.state = transition.to;
      if (transition.pixCode) current.pixCode = transition.pixCode;
    },
  };
  const publisher = new OrderTransitionPublisher(
    { async publish(event) {
      assert.equal(database.committed, true);
      events.push(event);
    } },
    () => new Date('2026-08-27T12:00:00.000Z'),
    (() => { let id = 0; return () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`; })(),
    () => '0123456789abcdef0123456789abcdef',
  );
  return {
    consumer: new OrderEventConsumer(
      entityManager,
      inbox,
      workflows,
      async () => [{ productId: 'product-1', quantity: 1 }],
      new OrderSaga(),
      publisher,
    ),
    database,
    events,
  };
}

function sagaEvent(eventId, eventType, payload) {
  return { eventId, eventType, payload };
}
