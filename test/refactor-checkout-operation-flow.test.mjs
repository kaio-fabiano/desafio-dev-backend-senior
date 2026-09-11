import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { promisify } from 'node:util';
import test from 'node:test';

const execute = promisify(execFile);
const classes = [
  'dev.desafio.transaction.transaction.checkout.CheckoutServiceTest',
  'dev.desafio.transaction.transaction.adapter.persistence.JpaTransactionPersistenceTest',
  'dev.desafio.transaction.transaction.application.TransactionAxonTest',
  'dev.desafio.transaction.transaction.adapter.woocommerce.WooCommerceGraphQlOrderAdapterTest',
  'dev.desafio.transaction.graphql.OrderWorkflowGraphQlCompatibilityTest',
  'dev.desafio.transaction.subscription.TransactionSubscriptionSseTest',
  'dev.desafio.transaction.infrastructure.messaging.RabbitMqBoundaryIntegrationTest',
  'dev.desafio.transaction.payment.adapter.mercadopago.MercadoPagoPaymentProviderTest',
];
const checkoutBaseline = execute(
  './gradlew',
  ['test', '--no-daemon', ...classes.flatMap((name) => ['--tests', name])],
  { cwd: 'apps/payment-federation', maxBuffer: 16 * 1024 * 1024 },
);

test('The checkout refactor closes every acceptance criterion without skipped Java evidence @spec:AC-333 @spec:AC-334 @spec:AC-335 @spec:AC-336 @spec:AC-337 @spec:AC-338 @spec:AC-339 @spec:AC-340 @spec:AC-341 @spec:AC-342 @spec:AC-343 @spec:AC-344 @spec:AC-345 @spec:AC-346 @spec:AC-347 @spec:AC-348 @spec:AC-349 @spec:AC-350', async () => {
  await checkoutBaseline;
  const evidence = (
    await Promise.all(classes.map((name) => readFile(
      `apps/payment-federation/build/test-results/test/TEST-${name}.xml`,
      'utf8',
    )))
  ).join('\n');

  assert.doesNotMatch(evidence, /failures="[1-9]/);
  assert.doesNotMatch(evidence, /skipped="[1-9]/);
  for (const criterion of Array.from({ length: 18 }, (_, index) => index + 333)) {
    assert.match(evidence, new RegExp(`@spec:AC-${criterion}(?:\\W|$)`), `missing Java evidence for AC-${criterion}`);
  }
});

test('Checkout source has no polling, lease, claim, or ownership exclusion @spec:AC-348', async () => {
  const roots = [
    'apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout',
    'apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/adapter/persistence',
  ];
  const files = (await Promise.all(roots.map(async (root) =>
    (await readdir(root, { recursive: true }))
      .filter((name) => /\.(java|sql)$/.test(name))
      .map((name) => `${root}/${name}`)
  ))).flat();
  const source = (await Promise.all(files.map((file) => readFile(file, 'utf8')))).join('\n');

  assert.doesNotMatch(source, /ClaimRequest|ownerToken|owner_token|leaseUntil|lease_until|CheckoutBusyException|Thread\.sleep|TimeUnit\.sleep|waitTimeout/);
});
