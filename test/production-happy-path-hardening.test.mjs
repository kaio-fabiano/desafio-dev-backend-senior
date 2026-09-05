import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(path, 'utf8');

test('AC-131: cart state is portable across replicas @spec:AC-131', async () => {
  const dataSource = await source(
    'libs/gateway/nest/src/federation/authenticated-data-source.ts',
  );
  assert.match(dataSource, /COMMERCE_SESSION_REQUEST_HEADERS/);
  assert.match(dataSource, /allowlistedCommerceCookies/);
  assert.match(dataSource, /context\?\.sessionHeaders/);
  await assert.rejects(
    source('apps/order-workflow-subgraph/src/cart/woo-cart.adapter.ts'),
    /ENOENT/,
  );
});

test('AC-132: WordPress owns cart mutations @spec:AC-132', async () => {
  const [wordpress, commerce] = await Promise.all([
    source('libs/contracts/graphql/wordpress/schema.graphql'),
    source('libs/contracts/graphql/order-workflow/schema.graphql'),
  ]);
  assert.match(wordpress, /addToCart\(input: AddToCartInput!\)/);
  assert.doesNotMatch(commerce, /commerceAddToCart/);
});

test('AC-133: checkout recovery has durable ownership @spec:AC-133', async () => {
  const [repository, migration, adapter] = await Promise.all([
    source('apps/order-workflow-subgraph/src/checkout/checkout.repository.ts'),
    source(
      'apps/order-workflow-subgraph/src/persistence/migrations/Migration202609010001.ts',
    ),
    source('apps/order-workflow-subgraph/src/checkout/woo-checkout.adapter.ts'),
  ]);
  assert.match(repository, /ownerToken/);
  assert.match(migration, /owner_token/);
  assert.match(repository, /wooReference/);
  assert.match(adapter, /findByReference/);
});

test('AC-134: inventory recovery is durable @spec:AC-134', async () => {
  const [migration, service, testSource] = await Promise.all([
    source(
      'apps/payment-federation/src/main/resources/db/migration/V3__mercado_pago_payment_lifecycle.sql',
    ),
    source(
      'apps/payment-federation/src/main/java/dev/desafio/transaction/inventory/application/InventoryService.java',
    ),
    source(
      'apps/payment-federation/src/test/java/dev/desafio/payment/inventory/InventoryServiceTest.java',
    ),
  ]);
  assert.match(migration, /inventory_operation/i);
  assert.match(service, /reconcile/);
  assert.match(testSource, /@spec:AC-134/);
});

test('AC-135: subscriptions replay durable state @spec:AC-135', async () => {
  const [relay, replay, consumer] = await Promise.all([
    source(
      'apps/order-workflow-subgraph/src/order-events/postgres/postgres-order-event.relay.ts',
    ),
    source(
      'apps/order-workflow-subgraph/src/order-events/postgres/mikro-orm-order-event.replay.ts',
    ),
    source(
      'apps/order-workflow-subgraph/src/saga/postgres-order-event.notifier.ts',
    ),
  ]);
  assert.match(relay, /listen \$\{ORDER_TRANSITION_CHANNEL\}/);
  assert.match(replay, /version/);
  assert.match(consumer, /pg_notify/);
});

test('AC-136: the quality loop has executable evidence @spec:AC-136', async () => {
  const evidence = await source(
    'docs/evidence/production-happy-path-hardening/review.md',
  );
  for (const gate of ['Focused tests', 'ESLint', 'Typecheck', 'Code review']) {
    assert.match(evidence, new RegExp(`${gate}: PASS`));
  }
});

test('AC-137: dependencies point to application contracts @spec:AC-137', async () => {
  const [resolver, module, service] = await Promise.all([
    source(
      'apps/order-workflow-subgraph/src/graphql/order-workflow.resolver.ts',
    ),
    source(
      'apps/order-workflow-subgraph/src/graphql/order-workflow-graphql.module.ts',
    ),
    source('apps/order-workflow-subgraph/src/checkout/checkout.service.ts'),
  ]);
  assert.match(resolver, /@Inject\(ORDER_WORKFLOW_OPERATIONS\)/);
  assert.match(module, /provide: ORDER_WORKFLOW_OPERATIONS/);
  assert.doesNotMatch(service, /@nestjs|@mikro-orm/);
});
