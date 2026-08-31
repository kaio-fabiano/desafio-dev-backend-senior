import assert from 'node:assert/strict';
import { test } from 'node:test';

import { CheckoutService } from '../apps/commerce-subgraph/src/checkout/checkout.service.ts';

function recoveryHarness() {
  const operation = {
    id: 'operation-1',
    subject: 'buyer-123',
    operationKey: 'checkout-123',
    commandHash: undefined,
    wooReference: undefined,
  };
  const visible = { workflow: undefined, event: undefined };
  let confirmationAttempts = 0;
  let remoteCreations = 0;
  let remoteOrder;
  const repository = {
    async claim(input) {
      operation.commandHash ??= input.commandHash;
      operation.wooReference ??= input.wooReference;
      return {
        operation,
        created: operation.commandHash === input.commandHash,
      };
    },
    async confirm(operationId, wooOrderId, stockItems, onConfirmed) {
      confirmationAttempts += 1;
      const workflow = {
        id: 'workflow-1',
        checkoutOperationId: operationId,
        wooOrderId,
        stockItems,
      };
      const pending = { workflow, event: undefined };
      await onConfirmed(pending, workflow);
      if (confirmationAttempts === 1)
        throw new Error('simulated local commit failure');
      visible.workflow = pending.workflow;
      visible.event = pending.event;
      operation.wooOrderId = wooOrderId;
      return workflow;
    },
  };
  const outbox = {
    async enqueueCheckoutRequested(transaction, workflowId, event) {
      transaction.event = { workflowId, event, sentAt: undefined };
    },
  };
  const wooOrders = {
    async createOrFind({ reference }) {
      if (!remoteOrder) {
        remoteCreations += 1;
        remoteOrder = { id: 'woo-9001', reference };
      }
      return remoteOrder;
    },
  };
  return {
    service: new CheckoutService(repository, outbox, wooOrders),
    operation,
    visible,
    remoteCreations: () => remoteCreations,
  };
}

const command = {
  subject: 'buyer-123',
  operationKey: 'checkout-123',
  paymentMethod: 'card',
  cartSnapshot: { items: [{ productId: 42, quantity: 1 }] },
};

test('AC-038: Pending WooCommerce checkout is reconciled @spec:AC-038', async () => {
  const { service, operation, visible, remoteCreations } = recoveryHarness();
  await assert.rejects(
    service.checkout(command),
    /simulated local commit failure/,
  );
  assert.equal(operation.wooOrderId, undefined);
  assert.deepEqual(visible, { workflow: undefined, event: undefined });

  const recovered = await service.reconcile(command);
  assert.equal(recovered.wooOrderId, 'woo-9001');
  assert.equal(operation.wooOrderId, 'woo-9001');
  assert.equal(remoteCreations(), 1);
  assert.equal(visible.workflow.wooOrderId, 'woo-9001');
  assert.deepEqual(visible.workflow.stockItems, [
    { productId: '42', quantity: 1 },
  ]);
  assert.equal(visible.event.event.checkoutId, 'operation-1');
});

test('AC-039: Workflow and event are committed together @spec:AC-039', async () => {
  const { service, visible } = recoveryHarness();
  await assert.rejects(service.checkout(command));
  assert.deepEqual(visible, { workflow: undefined, event: undefined });

  await service.checkout(command);
  assert.equal(visible.workflow.id, 'workflow-1');
  assert.equal(visible.event.workflowId, visible.workflow.id);
  assert.equal(visible.event.sentAt, undefined);
});
