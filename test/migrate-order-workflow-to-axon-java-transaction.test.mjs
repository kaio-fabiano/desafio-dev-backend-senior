import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const productionRoot =
  'apps/payment-federation/src/main/java/dev/desafio/transaction/transaction';
const testRoot =
  'apps/payment-federation/src/test/java/dev/desafio/transaction/transaction';

async function javaSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const path = `${directory}/${entry.name}`;
        return entry.isDirectory() ? javaSources(path) : [path];
      }),
    )
  )
    .flat()
    .filter((path) => path.endsWith('.java'));
}

async function contents(directory) {
  return Promise.all(
    (await javaSources(directory)).map((file) => readFile(file, 'utf8')),
  );
}

test('Axon commands, event sourcing, projections, and queries remain distinct @spec:AC-281', async () => {
  const source = (await contents(productionRoot)).join('\n');
  assert.match(source, /@CommandHandler/);
  assert.match(source, /@EventSourced\s*\(/);
  assert.match(source, /@EventSourcingHandler/);
  assert.match(source, /@EventHandler/);
  assert.match(source, /@QueryHandler/);
  assert.match(source, /TransactionViewStore/);
});

test('Transaction state is replayed by the Axon fixture without side effects @spec:AC-282', async () => {
  const tests = (await contents(testRoot)).join('\n');
  assert.match(tests, /AxonTestFixture/);
  assert.match(tests, /PostgreSQLContainer/);
  assert.match(
    tests,
    /Transaction replay restores durable state without side effects @spec:AC-282/,
  );
  assert.doesNotMatch(tests, /@Disabled|\.skip\(|\.todo\(/);
});

test('Checkout concurrency, conflicts, bounded waits, and ambiguity remain idempotent @spec:AC-285', async () => {
  const tests = (await contents(testRoot)).join('\n');
  assert.match(
    tests,
    /Concurrent identical checkout observes one Transaction and one Woo order @spec:AC-285/,
  );
  assert.match(
    tests,
    /Expired checkout lease is recovered for Woo reconciliation @spec:AC-285/,
  );
  assert.match(
    tests,
    /Ambiguous Woo success is reconciled before checkout retries creation @spec:AC-285/,
  );
});

test('Transaction choreography records local facts and contains no coordinator @spec:AC-286', async () => {
  const files = [
    'apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/domain/Transaction.java',
    'apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/command/RecordTransactionOutcomeHandler.java',
  ];
  const source = (
    await Promise.all(files.map((file) => readFile(file, 'utf8')))
  ).join('\n');
  assert.doesNotMatch(
    source,
    /\b(Saga|Workflow|Orchestrator|Coordinator|ProcessManager)\b/,
  );
  assert.doesNotMatch(source, /dev\.desafio\.transaction\.(inventory|payment)/);
  assert.doesNotMatch(
    source,
    /(Inventory|Payment).*CommandGateway|CommandGateway.*(Inventory|Payment)/,
  );
});

test('OrderReceived leaves Transaction only through the durable AMQP outbox @spec:AC-293', async () => {
  const [source, listener, tests] = await Promise.all([
    readFile(
      `${productionRoot}/adapter/persistence/JdbcTransactionOutbox.java`,
      'utf8',
    ),
    readFile(
      `${productionRoot}/adapter/messaging/TransactionRabbitListener.java`,
      'utf8',
    ),
    contents(testRoot),
  ]);
  assert.match(source, /transaction\.order-received\.v1/);
  assert.doesNotMatch(source, /providerToken|accessToken|cardToken/);
  assert.match(listener, /ReliableAmqpConsumer/);
  assert.match(
    tests.join('\n'),
    /OrderReceived is mapped once to the Transaction AMQP outbox without credentials @spec:AC-293/,
  );
});

test('Transaction migration participates in the Java repository quality gate @spec:AC-292', async () => {
  const migration = await readFile(
    'apps/payment-federation/src/main/resources/db/migration/transaction/R__transaction_checkout.sql',
    'utf8',
  );
  assert.match(migration, /transaction\.checkout_operation/);
  assert.match(migration, /transaction\.transaction_view/);
  assert.match(migration, /unique.*woo_order_id/is);
  assert.doesNotMatch(migration, /references\s+(inventory|payment)\./i);
  const baseline = await readFile(
    'test/migrate-order-workflow-to-axon-java.test.mjs',
    'utf8',
  );
  assert.match(baseline, /payment-federation:test/);
});
