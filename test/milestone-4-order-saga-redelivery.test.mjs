import assert from 'node:assert/strict';
import { test } from 'node:test';

import { OrderWorkflowState } from '../apps/commerce-subgraph/src/saga/order-saga.ts';
import { event, harness } from './milestone-4-order-saga.test.mjs';

test('AC-051: Redelivery after commit acknowledges without repeating transition or outbox @spec:AC-051', async () => {
  const testHarness = harness(OrderWorkflowState.PaymentPending);
  const authorized = event('redelivered-1', 'payment.authorized', {
    orderId: 'order-1',
    paymentId: 'payment-1',
  });
  let acknowledgementAttempts = 0;

  await assert.rejects(
    testHarness.consumer.handle(authorized, async () => {
      acknowledgementAttempts += 1;
      throw new Error('simulated crash before acknowledgement');
    }),
    /simulated crash before acknowledgement/,
  );
  const redelivery = await testHarness.consumer.handle(authorized, async () => {
    acknowledgementAttempts += 1;
  });
  const committed = testHarness.snapshot();

  assert.equal(redelivery.outcome, 'duplicate');
  assert.equal(acknowledgementAttempts, 2);
  assert.equal(committed.inbox.size, 1);
  assert.deepEqual(committed.history, [
    OrderWorkflowState.PaymentAuthorized,
    OrderWorkflowState.StockPending,
  ]);
  assert.equal(committed.outbox.length, 1);
});

test('AC-051: Transition, inbox, and next outbox commit atomically @spec:AC-051', async () => {
  const testHarness = harness(OrderWorkflowState.PaymentPending);
  const authorized = event('atomic-1', 'payment.authorized', {
    orderId: 'order-1',
    paymentId: 'payment-1',
  });
  let acknowledgements = 0;
  testHarness.failNextOutbox();

  await assert.rejects(
    testHarness.consumer.handle(authorized, async () => {
      acknowledgements += 1;
    }),
    /simulated next outbox failure/,
  );
  const rolledBack = testHarness.snapshot();
  assert.equal(rolledBack.workflow.state, OrderWorkflowState.PaymentPending);
  assert.equal(rolledBack.inbox.size, 0);
  assert.equal(rolledBack.outbox.length, 0);
  assert.equal(acknowledgements, 0);

  await testHarness.consumer.handle(authorized, async () => {
    acknowledgements += 1;
  });
  const retried = testHarness.snapshot();
  assert.equal(retried.workflow.state, OrderWorkflowState.StockPending);
  assert.equal(retried.inbox.size, 1);
  assert.equal(retried.outbox.length, 1);
  assert.equal(acknowledgements, 1);
});
