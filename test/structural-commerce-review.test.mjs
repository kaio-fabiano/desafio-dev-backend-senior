import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CheckoutInputError,
  CheckoutService,
} from '../apps/order-workflow-subgraph/src/checkout/checkout.service.ts';

test('AC-123: Order Workflow owns only deterministic workflow state @spec:AC-123', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) =>
    readFile(
      'apps/order-workflow-subgraph/src/checkout/checkout.service.ts',
      'utf8',
    ),
  );
  assert.match(source, /CheckoutService/);
  assert.doesNotMatch(source, /class (?:Product|Cart|Inventory)/);
});

test('AC-143: concurrent checkout creates one order @spec:AC-143', async () => {
  let operation;
  let wooCreates = 0;
  const repository = {
    async claim(input) {
      if (operation) return { operation, ownerToken: null };
      operation = {
        id: 'checkout-1',
        ...input,
        wooOrderId: null,
      };
      operation.status = 'PENDING_WOO';
      operation.ownerToken = 'owner-1';
      return { operation, ownerToken: 'owner-1' };
    },
    async beginCreation() {
      operation.status = 'CREATING_WOO';
    },
    async release() {
      operation.ownerToken = undefined;
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
    {
      async enqueueCheckoutRequested() {
        return undefined;
      },
    },
    {
      async findByReference() {
        return null;
      },
      async createOrFind() {
        wooCreates += 1;
        await new Promise((resolve) => setTimeout(resolve, 75));
        return {
          id: 'woo-1',
          cartSnapshot: {
            items: [{ id: 1001, quantity: 1 }],
            totals: {
              total_price: '1990',
              currency_minor_unit: 2,
              currency_code: 'BRL',
            },
          },
        };
      },
    },
  );
  const command = {
    subject: 'buyer-1',
    operationKey: 'operation-1',
    paymentMethod: 'CARD',
    payerEmail: 'buyer-1@example.test',
    providerToken: 'provider-token-1',
    paymentMethodId: 'visa',
  };

  const [first, duplicate] = await Promise.all([
    service.checkout(command),
    service.checkout(command),
  ]);
  assert.deepEqual(first, duplicate);
  assert.equal(wooCreates, 1);

  await assert.rejects(
    service.checkout({ ...command, paymentMethod: '' }),
    CheckoutInputError,
  );
});

test('AC-144: an operation key cannot change owner or command @spec:AC-144', async () => {
  const operation = {
    id: 'checkout-1',
    subject: 'buyer-1',
    operationKey: 'operation-1',
    commandHash: 'bound-command',
    wooReference: 'order-workflow-reference',
    status: 'PENDING_WOO',
  };
  const service = new CheckoutService(
    {
      async claim() {
        return { operation, ownerToken: null };
      },
    },
    {},
    {},
  );

  await assert.rejects(
    service.checkout({
      subject: 'buyer-2',
      operationKey: operation.operationKey,
      paymentMethod: 'CARD',
      payerEmail: 'buyer-2@example.test',
      providerToken: 'provider-token-2',
      paymentMethodId: 'visa',
    }),
    /already bound/,
  );
  await assert.rejects(
    service.checkout({
      subject: operation.subject,
      operationKey: operation.operationKey,
      paymentMethod: 'PIX',
      payerEmail: 'buyer-1@example.test',
    }),
    /already bound/,
  );
});
