import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('@spec:AC-201 resolved SSE startup and lifecycle evidence remains discoverable', async () => {
  const [gateway, client, controller, integration] = await Promise.all([
    readFile('apps/gateway/src/app.module.ts', 'utf8'),
    readFile('apps/gateway/src/subscriptions/order-workflow-subscription.client.ts', 'utf8'),
    readFile('apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/interfaces/graphql/TransactionSubscriptionController.java', 'utf8'),
    readFile('apps/payment-federation/src/test/java/dev/desafio/transaction/subscription/TransactionSubscriptionSseTest.java', 'utf8'),
  ]);
  assert.match(gateway, /graphql\/stream/);
  assert.match(client, /createClient/);
  assert.match(controller, /Flux<TransactionView>/);
  assert.match(integration, /propagates cancellation/);
  assert.match(integration, /reconnects/);
});
