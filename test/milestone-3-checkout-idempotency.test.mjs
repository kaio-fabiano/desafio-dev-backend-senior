import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  CheckoutIdempotencyConflictError,
  CheckoutService,
} from '../apps/commerce-subgraph/src/checkout/checkout.service.ts';

function harness() {
  const operations = new Map();
  const workflows = new Map();
  const events = [];
  const remoteOrders = new Map();
  let remoteCreations = 0;
  let confirmation = Promise.resolve();
  const repository = {
    async claim(input) {
      const key = `${input.subject}:${input.operationKey}`;
      let operation = operations.get(key);
      if (!operation) {
        operation = {
          id: `operation-${operations.size + 1}`,
          ...input,
          status: 'PENDING_WOO',
        };
        operations.set(key, operation);
        return { operation, created: true };
      }
      return { operation, created: false };
    },
    async confirm(operationId, wooOrderId, _stockItems, onConfirmed, paymentMethod) {
      const precedingConfirmation = confirmation;
      let release;
      confirmation = new Promise((resolve) => {
        release = resolve;
      });
      await precedingConfirmation;
      try {
        const operation = [...operations.values()].find(
          ({ id }) => id === operationId,
        );
        const existing = workflows.get(operationId);
        if (existing) return existing;
        const workflow = {
          id: `workflow-${operationId}`,
          checkoutOperationId: operationId,
          wooOrderId,
          paymentMethod,
        };
        await onConfirmed({}, workflow);
        workflows.set(operationId, workflow);
        operation.wooOrderId = wooOrderId;
        operation.status = 'COMPLETED';
        return workflow;
      } finally {
        release();
      }
    },
  };
  const outbox = {
    async enqueueCheckoutRequested(_transaction, workflowId, event) {
      events.push({ workflowId, event });
    },
  };
  const wooOrders = {
    async createOrFind({ reference }) {
      await Promise.resolve();
      let order = remoteOrders.get(reference);
      if (!order) {
        remoteCreations += 1;
        order = { id: `woo-${remoteCreations}` };
        remoteOrders.set(reference, order);
      }
      return order;
    },
  };
  return {
    service: new CheckoutService(repository, outbox, wooOrders),
    operations,
    workflows,
    events,
    remoteCreations: () => remoteCreations,
  };
}

const command = {
  subject: 'buyer-123',
  operationKey: 'checkout-123',
  paymentMethod: 'card',
  cartSnapshot: { items: [{ productId: 42, quantity: 2 }] },
};

test('AC-035: Sequential retries return the original order @spec:AC-035', async () => {
  const { service, remoteCreations, workflows, events } = harness();
  const first = await service.checkout(command);
  const retry = await service.checkout({
    ...command,
    cartSnapshot: { items: [{ quantity: 2, productId: 42 }] },
  });

  assert.deepEqual(retry, first);
  assert.equal(remoteCreations(), 1);
  assert.equal(workflows.size, 1);
  assert.equal(events.length, 1);
  assert.equal([...workflows.values()][0].paymentMethod, 'card');
});

test('AC-035: Retries ignore volatile catalog fields and cart item order @spec:AC-035', async () => {
  const { service, remoteCreations } = harness();
  const priced = {
    ...command,
    cartSnapshot: {
      items: [
        { id: 42, quantity: 2, name: 'Before', stock_quantity: 7, prices: { price: '995' } },
        { id: 7, quantity: 1, name: 'Second', stock_quantity: 3, prices: { price: '500' } },
      ],
      totals: { total_price: '2490', currency_code: 'USD', currency_minor_unit: 2 },
      item_count: 3,
    },
  };
  const first = await service.checkout(priced);
  const retry = await service.checkout({
    ...priced,
    cartSnapshot: {
      items: [
        { id: 7, quantity: 1, name: 'Renamed', stock_quantity: 2, prices: { price: '500' } },
        { id: 42, quantity: 2, name: 'After', stock_quantity: 5, prices: { price: '995' } },
      ],
      totals: { currency_minor_unit: 2, currency_code: 'USD', total_price: '2490' },
      item_count: 99,
    },
  });

  assert.deepEqual(retry, first);
  assert.equal(remoteCreations(), 1);
});

test('AC-036: Concurrent retries create one order @spec:AC-036', async () => {
  const { service, remoteCreations, operations, workflows, events } = harness();
  const results = await Promise.all(
    Array.from({ length: 12 }, () => service.checkout(command)),
  );

  assert.deepEqual(
    new Set(results.map(({ operationId }) => operationId)).size,
    1,
  );
  assert.deepEqual(
    new Set(results.map(({ wooOrderId }) => wooOrderId)).size,
    1,
  );
  assert.equal(remoteCreations(), 1);
  assert.equal(operations.size, 1);
  assert.equal(workflows.size, 1);
  assert.equal(events.length, 1);
});

test('AC-037: Reusing a key for a different command conflicts @spec:AC-037', async () => {
  const { service, remoteCreations, operations } = harness();
  await service.checkout(command);

  await assert.rejects(
    service.checkout({ ...command, paymentMethod: 'pix' }),
    (error) =>
      error instanceof CheckoutIdempotencyConflictError &&
      error.code === 'CHECKOUT_IDEMPOTENCY_CONFLICT',
  );
  await assert.rejects(
    service.checkout({ ...command, cartSnapshot: { items: [] } }),
    CheckoutIdempotencyConflictError,
  );
  assert.equal(remoteCreations(), 1);
  assert.equal(operations.size, 1);
});

test('AC-037: Product, quantity, price, and payment changes conflict @spec:AC-037', async () => {
  for (const changed of [
    { items: [{ id: 43, quantity: 2, prices: { price: '1000' } }] },
    { items: [{ id: 42, quantity: 3, prices: { price: '1000' } }] },
    { items: [{ id: 42, quantity: 2, prices: { price: '1200' } }] },
  ]) {
    const { service } = harness();
    const priced = {
      ...command,
      cartSnapshot: { items: [{ id: 42, quantity: 2, prices: { price: '1000' } }] },
    };
    await service.checkout(priced);
    await assert.rejects(
      service.checkout({ ...priced, cartSnapshot: changed }),
      CheckoutIdempotencyConflictError,
    );
  }
});
