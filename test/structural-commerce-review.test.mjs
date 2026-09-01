import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CheckoutInputError,
  CheckoutService,
} from '../apps/commerce-subgraph/src/checkout/checkout.service.ts';

test('AC-123: Commerce keeps deterministic workflow ownership @spec:AC-123', async () => {
  let operation;
  let wooCreates = 0;
  const repository = {
    async claim(input) {
      if (operation) return { operation, created: false };
      operation = {
        id: 'checkout-1',
        ...input,
        wooOrderId: null,
      };
      return { operation, created: true };
    },
    async find() {
      return operation;
    },
    async confirm(_id, wooOrderId) {
      operation.wooOrderId = wooOrderId;
      return { id: 'workflow-1', wooOrderId };
    },
  };
  const service = new CheckoutService(
    repository,
    { async enqueueCheckoutRequested() {} },
    {
      async createOrFind() {
        wooCreates += 1;
        await new Promise((resolve) => setTimeout(resolve, 75));
        return { id: 'woo-1' };
      },
    },
  );
  const command = {
    subject: 'buyer-1',
    operationKey: 'operation-1',
    paymentMethod: 'CARD',
    cartSnapshot: {
      items: [{ id: 1001, quantity: 1 }],
      totals: {
        total_price: '1990',
        currency_minor_unit: 2,
        currency_code: 'BRL',
      },
    },
  };

  const [first, duplicate] = await Promise.all([
    service.checkout(command),
    service.checkout(command),
  ]);
  assert.deepEqual(first, duplicate);
  assert.equal(wooCreates, 1);

  await assert.rejects(
    service.checkout({
      ...command,
      operationKey: 'invalid-cart',
      cartSnapshot: { items: [], totals: {} },
    }),
    CheckoutInputError,
  );
});
