import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const mainRoot =
  'apps/payment-federation/src/main/java/dev/desafio/transaction/payment';
const testRoot =
  'apps/payment-federation/src/test/java/dev/desafio/transaction/payment';

async function javaSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const path = `${directory}/${entry.name}`;
        return entry.isDirectory()
          ? javaSources(path)
          : entry.name.endsWith('.java')
            ? [[path, await readFile(path, 'utf8')]]
            : [];
      }),
    )
  ).flat();
}

test('Payment JPA models stay inside the Payment persistence boundary @spec:AC-298', async () => {
  const sources = await javaSources(mainRoot);
  const persistence = sources.filter(([path]) => path.includes('/persistence/'));
  const inner = sources.filter(
    ([path]) => path.includes('/domain/') || path.includes('/application/'),
  );

  assert.ok(
    persistence.filter(([, source]) => /@Entity\b/.test(source)).length >= 5,
    'Payment records, effects, inbox, outbox, and notifications need JPA models',
  );
  assert.ok(
    persistence.some(([, source]) => /extends JpaRepository</.test(source)),
    'Payment must use Spring Data repositories',
  );
  assert.doesNotMatch(
    inner.map(([, source]) => source).join('\n'),
    /jakarta\.persistence|org\.springframework\.data/,
  );
  assert.doesNotMatch(
    persistence
      .filter(([, source]) => /@Entity\b/.test(source))
      .map(([, source]) => source)
      .join('\n'),
    /@(ManyToOne|OneToMany|OneToOne|ManyToMany)\b|CascadeType/,
  );
});

test('Payment ORM preserves financial idempotency and reference meanings @spec:AC-300', async () => {
  const [sources, tests, migration] = await Promise.all([
    javaSources(mainRoot),
    javaSources(testRoot),
    readFile(
      'apps/payment-federation/src/main/resources/db/migration/payment/R__axon_payment_provider_effect_protocol.sql',
      'utf8',
    ),
  ]);
  const persistence = sources
    .filter(([path]) => path.includes('/persistence/'))
    .map(([, source]) => source)
    .join('\n');
  const testSources = tests.map(([, source]) => source).join('\n');

  assert.match(persistence, /LockModeType\.PESSIMISTIC_WRITE/);
  assert.match(persistence, /implements PaymentRepository/);
  assert.match(persistence, /implements PaymentEffectLedger/);
  assert.match(persistence, /implements PaymentProjection/);
  assert.match(persistence, /implements ProviderNotificationHandler\.Repository/);
  assert.match(persistence, /implements PaymentViewRepository/);
  assert.match(migration, /transaction_id/);
  assert.match(
    testSources,
    /Payment JPA adapters preserve reloaded state and financial idempotency @spec:AC-300/,
  );
  assert.doesNotMatch(testSources, /@Disabled|\.skip\(|\.todo\(/);
});

test('Flyway-created Payment schema validates every JPA mapping @spec:AC-304', async () => {
  const [application, tests] = await Promise.all([
    readFile('apps/payment-federation/src/main/resources/application.yaml', 'utf8'),
    javaSources(testRoot),
  ]);
  const testSources = tests.map(([, source]) => source).join('\n');

  assert.match(application, /ddl-auto:\s*validate/);
  assert.match(application, /open-in-view:\s*false/);
  assert.match(
    testSources,
    /Flyway schema validates all Payment JPA mappings across restart @spec:AC-304/,
  );
});
