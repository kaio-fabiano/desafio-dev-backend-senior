import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path) => readFile(path, 'utf8');

test('AC-112: Payment Federation compensates inventory failure without duplicate effects @spec:AC-112', async () => {
  const [
    commerceSaga,
    configuration,
    inventoryListener,
    inventoryRepository,
    inventoryService,
    migration,
    paymentConfiguration,
    paymentConsumer,
    wooInventory,
  ] = await Promise.all([
    read('apps/commerce-subgraph/src/saga/order-saga.ts'),
    read(
      'apps/payment-processor/src/main/java/dev/desafio/payment/adapter/messaging/PaymentRuntimeConfiguration.java',
    ),
    read(
      'apps/payment-processor/src/main/java/dev/desafio/payment/adapter/messaging/InventoryRabbitListener.java',
    ),
    read(
      'apps/payment-processor/src/main/java/dev/desafio/payment/inventory/InventoryRepository.java',
    ),
    read(
      'apps/payment-processor/src/main/java/dev/desafio/payment/inventory/InventoryService.java',
    ),
    read(
      'apps/payment-processor/src/main/resources/db/migration/V2__inventory_inbox_outbox.sql',
    ),
    read(
      'apps/payment-processor/src/main/java/dev/desafio/payment/configuration/PaymentConfiguration.java',
    ),
    read(
      'apps/payment-processor/src/main/java/dev/desafio/payment/adapter/messaging/PaymentConsumer.java',
    ),
    read(
      'apps/payment-processor/src/main/java/dev/desafio/payment/inventory/WooInventoryAdapter.java',
    ),
  ]);

  assert.match(configuration, /stock\.reservation-requested/);
  assert.match(inventoryListener, /waitForConfirmsOrDie\(10_000\)/);
  assert.match(inventoryListener, /basicAck\(deliveryTag, false\)/);
  assert.match(inventoryService, /ConcurrentHashMap/);
  assert.match(
    inventoryService,
    /repository\.find\(request\.eventId\(\), request\.operationKey\(\)\)/,
  );
  assert.match(inventoryRepository, /on conflict \(operation_key\) do nothing/);
  assert.match(migration, /create table inventory_inbox/);
  assert.match(migration, /create table inventory_outbox/);
  assert.match(migration, /operation_key text not null unique/);

  assert.match(wooInventory, /mutation ReserveOrderInventory/);
  assert.match(wooInventory, /updateOrder\(input: \$input\)/);
  assert.match(wooInventory, /"status", "PROCESSING"/);
  assert.match(wooInventory, /"X-Authenticated-Scopes", "orders:write"/);
  assert.match(wooInventory, /\.POST\(/);
  assert.match(paymentConfiguration, /mutation UpdateOrderPayment/);
  assert.match(
    paymentConfiguration,
    /"X-Authenticated-Scopes", "orders:write"/,
  );
  assert.doesNotMatch(paymentConfiguration, /\/wp-json\/wc\/v3\/orders/);

  assert.match(commerceSaga, /'stock\.reservation-failed'/);
  assert.match(commerceSaga, /eventType: 'payment\.refund-requested'/);
  assert.match(paymentConsumer, /case "payment\.refund-requested"/);
});

test('AC-113: one Java Payment Federation image starts payment and inventory consumers @spec:AC-113', async () => {
  const [
    compose,
    configuration,
    dockerfile,
    inventoryListener,
    paymentListener,
  ] = await Promise.all([
    read('compose.yaml'),
    read(
      'apps/payment-processor/src/main/java/dev/desafio/payment/adapter/messaging/PaymentRuntimeConfiguration.java',
    ),
    read('apps/payment-processor/Dockerfile'),
    read(
      'apps/payment-processor/src/main/java/dev/desafio/payment/adapter/messaging/InventoryRabbitListener.java',
    ),
    read(
      'apps/payment-processor/src/main/java/dev/desafio/payment/adapter/messaging/PaymentRabbitListener.java',
    ),
  ]);

  for (const service of [
    'rabbitmq',
    'commerce-database',
    'identity-database',
    'payment-database',
    'wordpress-database',
    'wordpress',
    'gateway',
    'identity-subgraph',
    'commerce-subgraph',
    'payment-processor',
    'wordpress-federation',
    'apollo-mcp',
  ]) {
    assert.match(compose, new RegExp(`^  ${service}:`, 'm'));
  }
  assert.doesNotMatch(compose, /^  stock-worker:/m);
  assert.match(
    compose,
    /payment-processor:[\s\S]*?RABBITMQ_URL: amqp:\/\/rabbitmq:5672/,
  );
  assert.match(
    compose,
    /payment-processor:[\s\S]*?WORDPRESS_GRAPHQL_URL: http:\/\/wordpress-federation:3004\/graphql/,
  );
  assert.match(
    compose,
    /payment-processor:[\s\S]*?rabbitmq:\n        condition: service_healthy/,
  );
  assert.match(configuration, /PAYMENT_QUEUE = "payment-processor\.v1"/);
  assert.match(
    configuration,
    /INVENTORY_QUEUE = "payment-federation\.inventory\.v1"/,
  );
  assert.match(paymentListener, /@RabbitListener/);
  assert.match(inventoryListener, /@RabbitListener/);
  assert.match(dockerfile, /ENTRYPOINT \["java", "-jar", "\/app\/app\.jar"\]/);
});
