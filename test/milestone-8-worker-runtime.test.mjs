import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { InventoryService } from '../apps/stock-worker/src/inventory/inventory.service.ts';
import { consumeStock } from '../apps/stock-worker/src/messaging/rabbitmq.runtime.ts';

const paymentFiles = await Promise.all(
  [
    'apps/payment-processor/src/main/java/dev/desafio/payment/adapter/messaging/PaymentRabbitListener.java',
    'apps/payment-processor/src/main/java/dev/desafio/payment/adapter/messaging/PaymentRuntimeConfiguration.java',
    'apps/payment-processor/src/main/java/dev/desafio/payment/adapter/persistence/PaymentRepository.java',
    'apps/payment-processor/src/main/resources/application.yaml',
  ].map((path) => readFile(path, 'utf8')),
);
const paymentRuntime = paymentFiles.join('\n');
const stockRuntime = await readFile(
  'apps/stock-worker/src/messaging/rabbitmq.runtime.ts',
  'utf8',
);
const stockComposition = await readFile(
  'apps/stock-worker/src/app.module.ts',
  'utf8',
);

test('AC-084: real workers persist deduplication and use bounded retry, DLQ, and explicit acknowledgement @spec:AC-084', async () => {
  assert.match(paymentRuntime, /payment_inbox/);
  assert.match(paymentRuntime, /basicAck/);
  assert.match(paymentRuntime, /RETRY_DELAYS = \{1_000, 10_000, 60_000\}/);
  assert.match(paymentRuntime, /marketplace\.dead-letter\.v1/);
  assert.match(stockComposition, /PostgresInboxRepository/);
  assert.match(stockRuntime, /RETRY_DELAYS = \[1_000, 10_000, 60_000\]/);
  assert.match(stockRuntime, /consumerChannel\.ack\(message\)/);
  assert.match(stockRuntime, /consumerChannel\.nack\(message, false, true\)/);

  const stored = new Map();
  let effects = 0;
  let publications = 0;
  const service = new InventoryService(
    {
      async find(id) {
        return stored.get(id) ?? null;
      },
      async record(id, result) {
        if (stored.has(id)) return false;
        stored.set(id, result);
        return true;
      },
    },
    {
      async reserve() {
        effects += 1;
      },
    },
    {
      async publish() {
        publications += 1;
      },
    },
  );
  const command = {
    eventId: 'event-84',
    operationKey: 'checkout-84',
    payload: { orderId: 'order-84', items: [{ productId: '42', quantity: 1 }] },
  };
  await Promise.all([service.handle(command), service.handle(command)]);
  await service.handle(command);
  assert.equal(effects, 1);
  assert.equal(stored.size, 1);
  assert.equal(publications, 1);
});

test('AC-084: Stock publishes on an independent channel before the consumer acknowledges @spec:AC-084', async () => {
  const sequence = [];
  let delivery;
  const consumerChannel = {
    async prefetch() {},
    async consume(_queue, handler) {
      delivery = handler;
    },
    ack() {
      sequence.push('ack');
    },
    nack() {
      sequence.push('nack');
    },
  };
  await consumeStock(consumerChannel, async () => {
    sequence.push('effect');
    await Promise.resolve().then(() => sequence.push('publisher-confirm'));
  });
  delivery({
    content: Buffer.from(JSON.stringify({ eventId: 'event-separated' })),
    properties: { headers: {}, messageId: 'event-separated' },
    fields: { routingKey: 'stock.reservation-requested' },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(sequence, ['effect', 'publisher-confirm', 'ack']);
  assert.match(stockComposition, /consumerBroker/);
  assert.match(stockComposition, /publisherBroker/);
});

test('AC-085: worker builds use pinned workspace or containerized tools and graceful shutdown @spec:AC-085', async () => {
  const [project, dockerfile, gradle, yaml] = await Promise.all([
    readFile('apps/payment-processor/project.json', 'utf8'),
    readFile('apps/payment-processor/Dockerfile', 'utf8'),
    readFile('apps/payment-processor/build.gradle.kts', 'utf8'),
    readFile(
      'apps/payment-processor/src/main/resources/application.yaml',
      'utf8',
    ),
  ]);
  assert.match(project, /gradle:8\.14\.3-jdk21/);
  assert.match(dockerfile, /gradle:8\.14\.3-jdk21/);
  assert.match(gradle, /JavaLanguageVersion\.of\(21\)/);
  assert.match(yaml, /shutdown: graceful/);
  assert.match(stockComposition, /SIGTERM/);
  assert.match(stockComposition, /this\.consumerBroker\?\.close\(\)/);
  assert.match(stockComposition, /this\.publisherBroker\?\.close\(\)/);
  assert.match(stockComposition, /await this\.database\?\.end\(\)/);
});

test('AC-086: worker domain and application code remain independent from runtime frameworks @spec:AC-086', async () => {
  const domain = await Promise.all([
    readFile(
      'apps/payment-processor/src/main/java/dev/desafio/payment/domain/Payment.java',
      'utf8',
    ),
    readFile(
      'apps/payment-processor/src/main/java/dev/desafio/payment/application/PaymentHandler.java',
      'utf8',
    ),
    readFile('apps/stock-worker/src/inventory/inventory.service.ts', 'utf8'),
  ]).then((files) => files.join('\n'));
  assert.doesNotMatch(
    domain,
    /org\.springframework|com\.rabbitmq|amqplib|\bpg\b|@nestjs|fetch\(|node:fs/,
  );
  assert.doesNotMatch(stockComposition, /commerce-subgraph/);
  assert.match(stockComposition, /createInventoryWorker/);
  assert.match(paymentRuntime, /PaymentHandler/);
});
