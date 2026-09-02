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
    read('apps/order-workflow-subgraph/src/saga/order-saga.ts'),
    read(
      'apps/payment-federation/src/main/java/dev/desafio/payment/adapter/messaging/PaymentRuntimeConfiguration.java',
    ),
    read(
      'apps/payment-federation/src/main/java/dev/desafio/payment/adapter/messaging/InventoryRabbitListener.java',
    ),
    read(
      'apps/payment-federation/src/main/java/dev/desafio/payment/inventory/InventoryRepository.java',
    ),
    read(
      'apps/payment-federation/src/main/java/dev/desafio/payment/inventory/InventoryService.java',
    ),
    read(
      'apps/payment-federation/src/main/resources/db/migration/V2__inventory_inbox_outbox.sql',
    ),
    read(
      'apps/payment-federation/src/main/java/dev/desafio/payment/configuration/PaymentConfiguration.java',
    ),
    read(
      'apps/payment-federation/src/main/java/dev/desafio/payment/adapter/messaging/PaymentConsumer.java',
    ),
    read(
      'apps/payment-federation/src/main/java/dev/desafio/payment/inventory/WooInventoryAdapter.java',
    ),
  ]);

  assert.match(configuration, /stock\.reservation-requested/);
  assert.match(inventoryListener, /waitForConfirmsOrDie\(10_000\)/);
  assert.match(inventoryListener, /basicAck\(deliveryTag, false\)/);
  assert.doesNotMatch(inventoryService, /ConcurrentHashMap/);
  assert.match(inventoryService, /repository\.claim\(request, fingerprint\(request\)\)/);
  assert.match(inventoryService, /stock\.reconcile\(request\)/);
  assert.match(inventoryRepository, /on conflict \(operation_key\) do nothing/);
  assert.match(migration, /create table inventory_inbox/);
  assert.match(migration, /create table inventory_outbox/);
  assert.match(migration, /operation_key text not null unique/);

  assert.match(wooInventory, /mutation ReserveOrderInventory/);
  assert.match(wooInventory, /updateOrder\(input: \$input\)/);
  assert.match(wooInventory, /"status", "PROCESSING"/);
  assert.match(wooInventory, /"inventory_operation_key"\.equals/);
  assert.match(wooInventory, /request\.operationKey\(\)\.equals/);
  assert.doesNotMatch(wooInventory, /if \("PROCESSING"\.equals\(status\)/);
  assert.match(wooInventory, /"Authorization", "Bearer " \+ bearerToken\(\)/);
  assert.match(wooInventory, /\.POST\(/);
  assert.match(paymentConfiguration, /mutation UpdateOrderPayment/);
  assert.match(
    paymentConfiguration,
    /WpGraphqlAuthentication\.bearerToken/,
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
      'apps/payment-federation/src/main/java/dev/desafio/payment/adapter/messaging/PaymentRuntimeConfiguration.java',
    ),
    read('apps/payment-federation/Dockerfile'),
    read(
      'apps/payment-federation/src/main/java/dev/desafio/payment/adapter/messaging/InventoryRabbitListener.java',
    ),
    read(
      'apps/payment-federation/src/main/java/dev/desafio/payment/adapter/messaging/PaymentRabbitListener.java',
    ),
  ]);

  for (const service of [
    'rabbitmq',
    'order-workflow-database',
    'identity-database',
    'payment-database',
    'wordpress-database',
    'wordpress',
    'gateway',
    'identity-subgraph',
    'order-workflow-subgraph',
    'payment-federation',
    'apollo-mcp',
  ]) {
    assert.match(compose, new RegExp(`^  ${service}:`, 'm'));
  }
  assert.doesNotMatch(compose, /^ {2}stock-worker:/m);
  assert.match(
    compose,
    /payment-federation:[\s\S]*?RABBITMQ_URL: amqp:\/\/rabbitmq:5672/,
  );
  assert.match(
    compose,
    /payment-federation:[\s\S]*?WORDPRESS_GRAPHQL_URL: http:\/\/wordpress\/graphql/,
  );
  assert.match(
    compose,
    /payment-federation:[\s\S]*?rabbitmq:\n {8}condition: service_healthy/,
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
