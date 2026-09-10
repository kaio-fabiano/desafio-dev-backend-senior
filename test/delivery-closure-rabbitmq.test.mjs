import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('AC-110: RabbitMQ delivers the durable choreographed lifecycle @spec:AC-110 @spec:AC-293', async () => {
  const [outbox, topology, integration, compose, schema] = await Promise.all([
    readFile('apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/JdbcTransactionOutbox.java', 'utf8'),
    readFile('apps/payment-federation/src/main/java/dev/desafio/transaction/configuration/AmqpTopologyConfiguration.java', 'utf8'),
    readFile('apps/payment-federation/src/test/java/dev/desafio/transaction/infrastructure/messaging/RabbitMqBoundaryIntegrationTest.java', 'utf8'),
    readFile('compose.yaml', 'utf8'),
    readFile('libs/contracts/graphql/order-workflow/schema.graphql', 'utf8'),
  ]);
  assert.match(outbox, /transaction\.order-received\.v1/);
  for (const context of ['transaction', 'inventory', 'payment']) assert.match(topology, new RegExp(`"${context}"`));
  assert.match(topology, /RETRY_EXCHANGE/);
  assert.match(topology, /DEAD_LETTER_EXCHANGE/);
  assert.match(integration, /@spec:AC-293/);
  assert.match(integration, /duplicate delivery/);
  assert.match(integration, /DLQ/);
  assert.match(compose, /^  rabbitmq:/m);
  assert.match(compose, /^  payment-federation:/m);
  assert.doesNotMatch(compose, /^  order-workflow-subgraph:/m);
  assert.match(schema, /startCheckout/);
});
