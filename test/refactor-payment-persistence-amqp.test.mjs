import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const persistenceRoot =
  'apps/payment-federation/src/main/java/dev/desafio/transaction/shared/infrastructure/persistence';
const messagingRoot =
  'apps/payment-federation/src/main/java/dev/desafio/transaction/shared/infrastructure/messaging';
const integrationTest =
  'apps/payment-federation/src/test/java/dev/desafio/transaction/infrastructure/messaging/JpaAmqpDeliveryPersistenceTest.java';

async function javaSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return Promise.all(
    entries
      .filter((entry) => entry.name.endsWith('.java'))
      .map(async (entry) => [entry.name, await readFile(`${directory}/${entry.name}`, 'utf8')]),
  );
}

test('Shared AMQP JPA models remain fixed to each owning schema @spec:AC-298', async () => {
  const [persistence, messaging] = await Promise.all([
    javaSources(persistenceRoot),
    javaSources(messagingRoot),
  ]);
  const entities = persistence.filter(([, source]) => /@Entity\b/.test(source));
  const entitySources = entities.map(([, source]) => source).join('\n');
  const messagingSources = messaging.map(([, source]) => source).join('\n');

  assert.equal(entities.length, 6, 'inbox and outbox need one entity per owning schema');
  for (const schema of ['transaction', 'inventory', 'payment']) {
    assert.match(entitySources, new RegExp(`@Table\\(name = "amqp_inbox", schema = "${schema}"\\)`));
    assert.match(entitySources, new RegExp(`@Table\\(name = "amqp_outbox", schema = "${schema}"\\)`));
  }
  assert.ok(
    persistence.some(([, source]) => /@MappedSuperclass\b/.test(source)),
    'identical delivery columns should be mapped once',
  );
  assert.doesNotMatch(entitySources, /@(ManyToOne|OneToMany|OneToOne|ManyToMany)\b|CascadeType/);
  assert.doesNotMatch(messagingSources, /import .*\.Jdbc(?:Inbox|Outbox)Store;/);
});

test('Shared delivery uses ORM locking for concurrent claims @spec:AC-302', async () => {
  const persistence = await javaSources(persistenceRoot);
  const sources = persistence.map(([, source]) => source).join('\n');
  const testSource = await readFile(integrationTest, 'utf8');

  assert.match(sources, /extends JpaRepository/);
  assert.match(sources, /LockModeType\.PESSIMISTIC_WRITE/);
  assert.match(sources, /jakarta\.persistence\.lock\.timeout/);
  assert.match(sources, /value = "-2"/);
  assert.doesNotMatch(
    persistence
      .filter(([name]) => name.startsWith('Jpa') || name.includes('JpaRepository'))
      .map(([, source]) => source)
      .join('\n'),
    /nativeQuery\s*=\s*true|JdbcTemplate|java\.sql/,
  );
  assert.match(
    testSource,
    /Concurrent inbox and outbox claims remain deduplicated and non-blocking @spec:AC-302/,
  );
});

test('Flyway schema remains authoritative for shared AMQP mappings @spec:AC-304', async () => {
  const [application, migration, testSource] = await Promise.all([
    readFile('apps/payment-federation/src/main/resources/application.yaml', 'utf8'),
    readFile(
      'apps/payment-federation/src/main/resources/db/migration/V6__reliable_amqp_boundaries.sql',
      'utf8',
    ),
    readFile(integrationTest, 'utf8'),
  ]);

  assert.match(application, /ddl-auto:\s*validate/);
  assert.match(application, /open-in-view:\s*false/);
  for (const schema of ['transaction', 'inventory', 'payment']) {
    assert.match(migration, new RegExp(`create table ${schema}\\.amqp_inbox`));
    assert.match(migration, new RegExp(`create table ${schema}\\.amqp_outbox`));
  }
  assert.match(
    testSource,
    /Flyway schema validates every shared AMQP JPA mapping across restart @spec:AC-304/,
  );
});
