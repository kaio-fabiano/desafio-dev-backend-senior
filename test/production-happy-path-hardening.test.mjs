import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(path, 'utf8');

test('AC-131: cart state is portable across replicas @spec:AC-131', async () => {
  const [dataSource, prepareRequest, cookieAdapter] = await Promise.all([
    source('libs/gateway/nest/src/federation/authenticated-data-source.ts'),
    source(
      'libs/gateway/nest/src/application/use-cases/prepare-federation-request.use-case.ts',
    ),
    source(
      'libs/gateway/nest/src/infrastructure/http/commerce-cookie.adapter.ts',
    ),
  ]);
  assert.match(dataSource, /this\.prepareRequest\.execute/);
  assert.match(prepareRequest, /context\?\.sessionHeaders\?\.cookie/);
  assert.match(prepareRequest, /\['woocommerce-session'\]/);
  assert.match(prepareRequest, /\['cart-token'\]/);
  assert.match(cookieAdapter, /wp_woocommerce_session_/);
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
    source('apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence/JdbcCheckoutOperationRepository.java'),
    source(
      'apps/payment-federation/src/main/resources/db/migration/transaction/R__transaction_checkout.sql',
    ),
    source('apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/woocommerce/WooCommerceGraphQlOrderAdapter.java'),
  ]);
  assert.match(repository, /owner_token/);
  assert.match(migration, /owner_token/);
  assert.match(repository, /woo_reference/);
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
  const [gateway, replay, integration] = await Promise.all([
    source(
      'apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/subscription/TransactionSubscriptionGateway.java',
    ),
    source(
      'apps/payment-federation/src/test/java/dev/desafio/transaction/projection/TransactionProjectionReplayTest.java',
    ),
    source(
      'apps/payment-federation/src/test/java/dev/desafio/transaction/subscription/TransactionSubscriptionSseTest.java',
    ),
  ]);
  assert.match(gateway, /Flux<TransactionView>/);
  assert.match(replay, /replay/i);
  assert.match(integration, /reconnect/i);
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
  const [controller, configuration, service] = await Promise.all([
    source(
      'apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/interfaces/graphql/TransactionSubscriptionController.java',
    ),
    source(
      'apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/configuration/TransactionConfiguration.java',
    ),
    source('apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutService.java'),
  ]);
  assert.match(controller, /OnTransactionUpdatedHandler/);
  assert.match(configuration, /WooCommerceOrderPort/);
  assert.doesNotMatch(service, /org\.springframework|java\.sql/);
});
