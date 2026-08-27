import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const evidence = {
  'AC-041': 'test/milestone-4-outbox-publisher.test.mjs',
  'AC-042': 'test/milestone-4-rabbitmq-topology.test.mjs',
  'AC-043': 'apps/payment-processor/src/test/java/dev/desafio/payment/application/PaymentHandlerTest.java',
  'AC-044': 'apps/payment-processor/src/test/java/dev/desafio/payment/application/PaymentHandlerTest.java',
  'AC-045': 'test/milestone-4-compose.test.mjs',
  'AC-046': 'test/milestone-4-inventory-worker.test.mjs',
  'AC-047': 'test/milestone-4-inventory-worker.test.mjs',
  'AC-048': 'test/milestone-4-order-saga.test.mjs',
  'AC-049': 'test/milestone-4-order-saga.test.mjs',
  'AC-050': 'test/milestone-4-order-saga.test.mjs',
  'AC-051': 'test/milestone-4-order-saga-redelivery.test.mjs',
};

const names = {
  'AC-041': 'Outbox publication waits for broker confirmation',
  'AC-042': 'Consumer failures have bounded retry and DLQ',
  'AC-043': 'Card authorization is applied once',
  'AC-044': 'Pix code generation is stable and terminal',
  'AC-045': 'Payment processor is operable through Nx',
  'AC-046': 'Stock reservation changes WooCommerce once',
  'AC-047': 'Insufficient stock requests compensation',
  'AC-048': 'Successful Card journey completes',
  'AC-049': 'Stock failure refunds and cancels',
  'AC-050': 'Pix journey exposes the generated code',
  'AC-051': 'Crash after effect before acknowledgement is harmless',
};

for (const [criterion, path] of Object.entries(evidence)) {
  test(`${criterion}: ${names[criterion]} @spec:${criterion}`, async () => {
    const source = await readFile(path, 'utf8');
    assert.match(source, new RegExp(`@spec:${criterion}\\b`));
    assert.doesNotMatch(source, /\b(?:test|it)\.(?:skip|todo)\b/);
  });
}

test('AC-052: Milestone acceptance runs from one workspace command @spec:AC-052', async () => {
  const project = JSON.parse(await readFile('apps/e2e/project.json', 'utf8'));
  const command = project.targets['milestone-4-acceptance'].options.command;
  assert.match(command, /milestone-4-payment-inventory-saga\.spec\.test\.js/);

  const config = JSON.parse(await readFile('onpspec.config.json', 'utf8'));
  const requiredSuites = [
    'milestone-4-event-contracts',
    'milestone-4-outbox-publisher',
    'milestone-4-rabbitmq-topology',
    'milestone-4-nx-gradle',
    'milestone-4-inventory-worker',
    'milestone-4-inventory-redelivery',
    'milestone-4-order-saga',
    'milestone-4-order-saga-redelivery',
    'milestone-4-compose',
    'milestone-4-payment-inventory-saga.spec',
  ];
  for (const suite of requiredSuites) assert.match(config.testCommand, new RegExp(suite));
});
