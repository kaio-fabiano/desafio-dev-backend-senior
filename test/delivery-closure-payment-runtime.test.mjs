import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('AC-111: Payment delivery is reliable and idempotent @spec:AC-111', async () => {
  const [
    build,
    configuration,
    handlerTest,
    listener,
    redeliveryTest,
    repository,
    migration,
    yaml,
  ] = await Promise.all([
    read('apps/payment-processor/build.gradle.kts'),
    read(
      'apps/payment-processor/src/main/java/dev/desafio/payment/adapter/messaging/PaymentRuntimeConfiguration.java',
    ),
    read(
      'apps/payment-processor/src/test/java/dev/desafio/payment/application/PaymentHandlerTest.java',
    ),
    read(
      'apps/payment-processor/src/main/java/dev/desafio/payment/adapter/messaging/PaymentRabbitListener.java',
    ),
    read(
      'apps/payment-processor/src/test/java/dev/desafio/payment/adapter/messaging/PaymentRedeliveryTest.java',
    ),
    read(
      'apps/payment-processor/src/main/java/dev/desafio/payment/adapter/persistence/PaymentRepository.java',
    ),
    read(
      'apps/payment-processor/src/main/resources/db/migration/V1__payment_inbox_outbox.sql',
    ),
    read('apps/payment-processor/src/main/resources/application.yaml'),
  ]);

  assert.match(build, /spring-boot-starter-amqp/);
  assert.doesNotMatch(build, /java\.exclude|PaymentRabbitListener\.java/);
  assert.match(yaml, /acknowledge-mode: manual/);
  assert.match(yaml, /prefetch: 10/);
  assert.match(yaml, /publisher-confirm-type: simple/);
  assert.match(yaml, /publisher-returns: true/);

  assert.match(migration, /create table payment_inbox/);
  assert.match(migration, /create table payment_outbox/);
  assert.match(migration, /event_id uuid primary key/);
  assert.match(migration, /effect_id uuid not null unique/);
  assert.match(repository, /connection\.setAutoCommit\(false\)/);
  assert.match(repository, /claimInbox\(connection, incomingEventId/);
  assert.match(repository, /on conflict \(event_id\) do nothing/);
  assert.match(repository, /UUID\.nameUUIDFromBytes/);
  assert.match(handlerTest, /authorizesCardOnceAcrossConcurrentRedelivery/);
  assert.match(redeliveryTest, /SimulatedCrash/);
  assert.match(redeliveryTest, /duplicateDelivery\(\)/);

  assert.match(configuration, /RETRY_DELAYS = \{1_000, 10_000, 60_000\}/);
  assert.match(configuration, /\.deadLetterExchange\(EVENTS\)/);
  assert.match(configuration, /new TopicExchange\(DEAD_LETTER, true, false\)/);
  assert.match(
    configuration,
    /QueueBuilder\.durable\(DEAD_LETTER_QUEUE\)\.quorum\(\)/,
  );
  assert.match(
    configuration,
    /BindingBuilder\.bind\(deadLetterQueue\)[\s\S]*?\.with\("#"\)/,
  );
  assert.doesNotMatch(configuration, /PaymentRepository paymentRepository/);

  assert.match(listener, /waitForConfirmsOrDie\(10_000\)/);
  assert.match(listener, /basicAck\(deliveryTag, false\)/);
  assert.match(listener, /basicNack\(deliveryTag, false, true\)/);
  assert.match(listener, /x-retry-attempt/);
  assert.match(listener, /PaymentRuntimeConfiguration\.RETRY/);
  assert.match(listener, /PaymentRuntimeConfiguration\.DEAD_LETTER/);
});
