import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = 'apps/payment-federation/src/main/java/dev/desafio/transaction/payment';

const source = (path) => readFile(`${root}/${path}`, 'utf8');

test('Payment commands, events, and queries use distinct Axon paths @spec:AC-281', async () => {
  const [command, entity, query] = await Promise.all([
    source('application/command/RequestPayment.java'),
    source('application/axon/PaymentAggregate.java'),
    source('application/query/FindPaymentHandler.java'),
  ]);

  assert.match(command, /@Command/);
  assert.match(entity, /@EventSourced/);
  assert.match(entity, /@EventSourcingHandler/);
  assert.match(query, /@QueryHandler/);
});

test('Payment state is reconstructed from durable Axon events @spec:AC-282', async () => {
  const fixture = await readFile(
    'apps/payment-federation/src/test/java/dev/desafio/transaction/payment/application/axon/PaymentAxonFixtureTest.java',
    'utf8',
  );

  assert.match(fixture, /EventSourcingConfigurer/);
  assert.match(fixture, /Payment replay rebuilds state without provider effects/);
  assert.doesNotMatch(fixture, /@Disabled/);
});

test('Payment invariants and provider idempotency survive Axon conversion @spec:AC-283', async () => {
  const [fixture, effects, webhook] = await Promise.all([
    readFile(
      'apps/payment-federation/src/test/java/dev/desafio/transaction/payment/application/axon/PaymentAxonFixtureTest.java',
      'utf8',
    ),
    readFile(
      'apps/payment-federation/src/test/java/dev/desafio/transaction/payment/application/axon/PaymentProviderEffectHandlerTest.java',
      'utf8',
    ),
    source('adapter/axon/AxonProviderNotificationHandler.java'),
  ]);

  assert.match(fixture, /Card, Pix, refund, duplicate, and conflicting intents preserve Payment invariants/);
  assert.match(effects, /Committed provider effects are not repeated by Axon redelivery/);
  assert.match(effects, /Ambiguous provider success is reconciled without repeating the effect/);
  assert.match(fixture, /Duplicate provider webhooks converge through an Axon command/);
  assert.match(webhook, /RecordProviderNotification/);
});

test('Payment consumes InventoryReserved and publishes through the AMQP outbox @spec:AC-293', async () => {
  const [listener, topology, publisher] = await Promise.all([
    source('adapter/messaging/AxonPaymentRabbitListener.java'),
    source('configuration/AxonPaymentMessagingConfiguration.java'),
    source('adapter/messaging/JdbcPaymentIntegrationEventPublisher.java'),
  ]);

  assert.match(listener, /inventory\.reserved\.v1/);
  assert.doesNotMatch(listener, /inventory\.reservation-rejected/);
  assert.match(topology, /payment\.events\.v1/);
  assert.match(publisher, /JdbcOutboxStore/);
});

test('Payment Axon migration participates in the repository quality gate @spec:AC-292', async () => {
  const [baseline, fixture] = await Promise.all([
    readFile('test/migrate-order-workflow-to-axon-java.test.mjs', 'utf8'),
    readFile(
      'apps/payment-federation/src/test/java/dev/desafio/transaction/payment/application/axon/PaymentAxonFixtureTest.java',
      'utf8',
    ),
  ]);

  assert.match(baseline, /payment-federation:test/);
  assert.match(fixture, /@spec:AC-282/);
  assert.match(fixture, /@spec:AC-283/);
  assert.doesNotMatch(fixture, /@Disabled/);
});
