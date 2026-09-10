import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const transactionRoot =
  'apps/payment-federation/src/main/java/dev/desafio/transaction/transaction';

async function javaSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const path = `${directory}/${entry.name}`;
        if (entry.isDirectory()) return javaSources(path);
        if (!entry.name.endsWith('.java')) return [];
        return [{ path, source: await readFile(path, 'utf8') }];
      }),
    )
  ).flat();
}

test('AC-298: Transaction JPA models stay inside its infrastructure boundary @spec:AC-298', async () => {
  const sources = await javaSources(transactionRoot);
  const entities = sources.filter(({ source }) => /@Entity\b/.test(source));
  const innerLayerLeaks = sources
    .filter(({ path }) => /\/(?:domain|application)\//.test(path))
    .filter(({ source }) => /import (?:jakarta\.persistence|org\.springframework\.data)/.test(source))
    .map(({ path }) => path);

  assert.ok(entities.length >= 3, 'checkout, transaction view, and outbox need JPA models');
  assert.ok(
    entities.every(({ path }) => /\/(?:adapter|infrastructure)\/persistence\//.test(path)),
    'JPA entities must remain in the outer persistence layer',
  );
  assert.deepEqual(innerLayerLeaks, []);
  assert.doesNotMatch(
    entities.map(({ source }) => source).join('\n'),
    /@(ManyToOne|OneToMany|OneToOne|ManyToMany)|CascadeType/,
  );
});

test('AC-301: Transaction ORM preserves leases, JSON, versions, and owner-scoped reads @spec:AC-301', async () => {
  const sources = await javaSources(transactionRoot);
  const persistence = sources
    .filter(({ path }) => /\/(?:adapter|infrastructure)\/persistence\//.test(path))
    .map(({ source }) => source)
    .join('\n');
  const integrationTest = await readFile(
    `${transactionRoot.replace('/main/', '/test/')}/adapter/persistence/JpaTransactionPersistenceTest.java`,
    'utf8',
  );

  assert.match(persistence, /@JdbcTypeCode\(SqlTypes\.JSON\)/);
  assert.match(persistence, /LockModeType\.PESSIMISTIC_WRITE/);
  assert.match(persistence, /findByTransactionIdAndSubject/);
  assert.match(persistence, /findByWooOrderIdAndOwnerSubject/);
  assert.match(integrationTest, /concurrent checkout claims preserve one lease/);
  assert.match(integrationTest, /stale projection events cannot regress owner-scoped views/);
  assert.match(integrationTest, /entityManager\.clear\(\)/);
});

test('AC-304: Flyway remains authoritative for Transaction ORM mappings @spec:AC-304', async () => {
  const [configuration, migration, sources] = await Promise.all([
    readFile('apps/payment-federation/src/main/resources/application.yaml', 'utf8'),
    readFile(
      'apps/payment-federation/src/main/resources/db/migration/transaction/R__transaction_checkout.sql',
      'utf8',
    ),
    javaSources(transactionRoot),
  ]);
  const entities = sources
    .filter(({ source }) => /@Entity\b/.test(source))
    .map(({ source }) => source)
    .join('\n');

  assert.match(configuration, /ddl-auto:\s*validate/);
  assert.match(configuration, /open-in-view:\s*false/);
  assert.match(migration, /transaction\.checkout_operation/);
  assert.match(migration, /transaction\.transaction_view/);
  assert.match(entities, /@Table\(name = "checkout_operation", schema = "transaction"\)/);
  assert.match(entities, /@Table\(name = "transaction_view", schema = "transaction"\)/);
  assert.doesNotMatch(entities, /@GeneratedValue/);
});
