import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { InboxDisposition } from '../apps/commerce-subgraph/src/inbox/inbox.repository.ts';
import { OrderEventConsumer } from '../apps/commerce-subgraph/src/saga/order-event.consumer.ts';
import { OrderWorkflowState } from '../apps/commerce-subgraph/src/saga/order-saga.ts';

const graphqlSchema = await readFile(
  new URL('../libs/contracts/graphql/commerce/schema.graphql', import.meta.url),
  'utf8',
);
const migration = await readFile(
  new URL(
    '../apps/commerce-subgraph/src/persistence/migrations/Migration202608270002.ts',
    import.meta.url,
  ),
  'utf8',
);

test('AC-048: Successful Card journey completes monotonically and emits each next command once @spec:AC-048', async () => {
  const testHarness = harness(OrderWorkflowState.PaymentPending);
  const reserved = event('reservation-1', 'stock.reserved', {
    orderId: 'order-1',
    reservationId: 'reservation-1',
  });

  await assert.rejects(
    testHarness.consumer.consume(reserved),
    /stock\.reserved arrived before STOCK_PENDING/,
  );
  await testHarness.consumer.consume(
    event('authorization-1', 'payment.authorized', {
      orderId: 'order-1',
      paymentId: 'payment-1',
    }),
  );
  await testHarness.consumer.consume(
    event('authorization-1', 'payment.authorized', {
      orderId: 'order-1',
      paymentId: 'payment-1',
    }),
  );
  const stale = await testHarness.consumer.consume(
    event('authorization-stale', 'payment.authorized', {
      orderId: 'order-1',
      paymentId: 'payment-1',
    }),
  );
  await testHarness.consumer.consume(reserved);
  const completed = testHarness.snapshot();

  assert.equal(stale.outcome, 'ignored');
  assert.equal(
    completed.inbox.get('authorization-stale').disposition,
    InboxDisposition.Ignored,
  );
  assert.deepEqual(completed.history, [
    OrderWorkflowState.PaymentAuthorized,
    OrderWorkflowState.StockPending,
    OrderWorkflowState.Completed,
  ]);
  assert.equal(completed.workflow.state, OrderWorkflowState.Completed);
  assert.deepEqual(completed.outbox, [
    {
      eventType: 'stock.reservation-requested',
      payload: {
        orderId: 'order-1',
        items: [{ productId: 'product-1', quantity: 2 }],
      },
    },
  ]);
});

test('AC-049: Stock failure emits one refund and advances through refunded to cancelled @spec:AC-049', async () => {
  const testHarness = harness(OrderWorkflowState.StockPending, 'payment-2');
  const failed = event('failure-1', 'stock.reservation-failed', {
    orderId: 'order-1',
    reason: 'INSUFFICIENT_STOCK',
  });

  await testHarness.consumer.consume(failed);
  await testHarness.consumer.consume(failed);
  await testHarness.consumer.consume(
    event('failure-stale', 'stock.reservation-failed', failed.payload),
  );
  await testHarness.consumer.consume(
    event('refund-1', 'payment.refunded', {
      orderId: 'order-1',
      paymentId: 'payment-2',
    }),
  );
  const cancelled = testHarness.snapshot();

  assert.deepEqual(cancelled.history, [
    OrderWorkflowState.StockFailed,
    OrderWorkflowState.RefundPending,
    OrderWorkflowState.Refunded,
    OrderWorkflowState.Cancelled,
  ]);
  assert.equal(cancelled.workflow.state, OrderWorkflowState.Cancelled);
  assert.deepEqual(cancelled.outbox, [
    {
      eventType: 'payment.refund-requested',
      payload: {
        orderId: 'order-1',
        paymentId: 'payment-2',
        reason: 'INSUFFICIENT_STOCK',
      },
    },
  ]);
});

test('AC-050: Pix generation is terminal, stable, and emits no stock or refund command @spec:AC-050', async () => {
  const testHarness = harness(OrderWorkflowState.PixPending);
  const generated = event('pix-1', 'payment.pix-generated', {
    orderId: 'order-1',
    paymentId: 'payment-3',
    pixCode: '000201BR-STABLE',
  });

  await testHarness.consumer.consume(generated);
  await testHarness.consumer.consume(generated);
  await testHarness.consumer.consume(
    event('pix-stale', 'payment.pix-generated', {
      ...generated.payload,
      pixCode: 'must-not-replace-the-stable-code',
    }),
  );
  const pix = testHarness.snapshot();

  assert.deepEqual(pix.history, [OrderWorkflowState.PixGenerated]);
  assert.equal(pix.workflow.state, OrderWorkflowState.PixGenerated);
  assert.equal(pix.workflow.pixCode, '000201BR-STABLE');
  assert.deepEqual(pix.outbox, []);
  for (const state of Object.values(OrderWorkflowState)) {
    assert.match(graphqlSchema, new RegExp(`\\b${state}\\b`));
  }
  assert.match(graphqlSchema, /pixCode: String/);
});

test('Migration202608270002 preserves T-029 and adds saga persistence', () => {
  assert.match(migration, /publication_attempts/);
  assert.match(migration, /last_publication_attempt_at/);
  assert.match(migration, /commerce_inbox_record/);
  assert.match(migration, /payment_id/);
  assert.match(migration, /pix_code/);
  assert.match(migration, /commerce_order_workflow_state_check/);
});

export function harness(initialState, paymentId) {
  let database = {
    history: [],
    inbox: new Map(),
    outbox: [],
    workflow: {
      id: 'workflow-1',
      wooOrderId: 'order-1',
      state: initialState,
      ...(paymentId ? { paymentId } : {}),
    },
  };
  let failNextOutbox = false;

  const entityManager = {
    async transactional(callback) {
      const working = structuredClone(database);
      const result = await callback({ database: working });
      database = working;
      return result;
    },
  };
  const inbox = {
    async claim(transaction, eventId, eventType) {
      if (transaction.database.inbox.has(eventId)) return false;
      transaction.database.inbox.set(eventId, { eventType });
      return true;
    },
    async complete(transaction, eventId, workflowId, disposition) {
      Object.assign(transaction.database.inbox.get(eventId), {
        disposition,
        workflowId,
      });
    },
  };
  const workflows = {
    async findForUpdate(transaction, orderId) {
      assert.equal(orderId, transaction.database.workflow.wooOrderId);
      return transaction.database.workflow;
    },
    async apply(transaction, workflow, transition) {
      transaction.database.history.push(...transition.states);
      workflow.state = transition.to;
      if (transition.paymentId) workflow.paymentId = transition.paymentId;
      if (transition.pixCode) workflow.pixCode = transition.pixCode;
      if (transition.command) {
        if (failNextOutbox) {
          failNextOutbox = false;
          throw new Error('simulated next outbox failure');
        }
        transaction.database.outbox.push(structuredClone(transition.command));
      }
    },
  };

  return {
    consumer: new OrderEventConsumer(
      entityManager,
      inbox,
      workflows,
      async () => [{ productId: 'product-1', quantity: 2 }],
    ),
    failNextOutbox() {
      failNextOutbox = true;
    },
    snapshot() {
      return database;
    },
  };
}

export function event(eventId, eventType, payload) {
  return { eventId, eventType, payload };
}
