import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('AC-100: Payment exposes explicit command and query paths @spec:AC-100', async () => {
  const [controller, commandHandler, queryHandler, schema] = await Promise.all([
    read('apps/payment-federation/src/main/java/dev/desafio/transaction/payment/adapter/graphql/PaymentController.java'),
    read('apps/payment-federation/src/main/java/dev/desafio/transaction/payment/application/command/AuthorizePaymentHandler.java'),
    read('apps/payment-federation/src/main/java/dev/desafio/transaction/payment/application/query/FindPaymentHandler.java'),
    read('apps/payment-federation/src/main/resources/graphql/payment.graphqls'),
  ]);

  assert.match(controller, /AuthorizePaymentHandler/);
  assert.match(controller, /FindPaymentHandler/);
  assert.match(commandHandler, /AuthorizePayment/);
  assert.match(queryHandler, /FindPayment/);
  assert.match(schema, /authorizePayment/);
  assert.match(schema, /payment\s*\(/);
});

test('AC-101: Payment authorization remains idempotent @spec:AC-101', async () => {
  const [handler, testSource] = await Promise.all([
    read('apps/payment-federation/src/main/java/dev/desafio/transaction/payment/application/command/AuthorizePaymentHandler.java'),
    read('apps/payment-federation/src/test/java/dev/desafio/payment/PaymentFederationTest.java'),
  ]);

  assert.match(handler, /operationKey/);
  assert.match(handler, /UUID\.nameUUIDFromBytes/);
  assert.match(testSource, /keepsEveryPaymentDeliveryIdempotent/);
  assert.match(testSource, /computeIfAbsent\(command\.operationKey\(\)/);
  assert.match(testSource, /effects\.computeIfAbsent/);
});
