import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const mainRoot =
  'apps/payment-federation/src/main/java/dev/desafio/transaction/inventory';
const testRoot =
  'apps/payment-federation/src/test/java/dev/desafio/transaction/inventory';

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

async function sourceTree(root) {
  const paths = await javaSources(root);
  return Promise.all(paths.map(async (path) => [path, await readFile(path, 'utf8')]));
}

test('Inventory JPA models stay inside the Inventory persistence boundary @spec:AC-298', async () => {
  const sources = await sourceTree(mainRoot);
  const persistence = sources.filter(([path]) => path.includes('/persistence/'));
  const inner = sources.filter(
    ([path]) => path.includes('/domain/') || path.includes('/application/'),
  );

  assert.ok(
    persistence.some(([, source]) => /@Entity\b/.test(source)),
    'Inventory must declare infrastructure-only JPA entities',
  );
  assert.ok(
    persistence.some(([, source]) => /extends JpaRepository</.test(source)),
    'Inventory must use Spring Data repositories',
  );
  assert.ok(
    persistence.some(([, source]) => /implements InventoryRepository/.test(source)),
  );
  assert.ok(
    persistence.some(([, source]) => /implements InventoryProjectionRepository/.test(source)),
  );
  assert.ok(
    persistence.some(([, source]) => /implements InventoryViewRepository/.test(source)),
  );
  assert.ok(
    persistence.some(([, source]) => /implements InventoryOutbox/.test(source)),
  );
  assert.doesNotMatch(
    inner.map(([, source]) => source).join('\n'),
    /jakarta\.persistence|org\.springframework\.data/,
  );
  assert.doesNotMatch(
    persistence.map(([, source]) => source).join('\n'),
    /@(ManyToOne|OneToMany|OneToOne|ManyToMany)\b/,
  );
});

test('Inventory claims and projections round-trip through dedicated JPA models @spec:AC-299', async () => {
  const [migration, tests] = await Promise.all([
    readFile(
      'apps/payment-federation/src/main/resources/db/migration/inventory/afterMigrate__inventory_axon_participant.sql',
      'utf8',
    ),
    sourceTree(testRoot),
  ]);
  const testSources = tests.map(([, source]) => source).join('\n');

  assert.match(migration, /create table (?:if not exists )?inventory\.inventory_reservation_projection/i);
  assert.match(migration, /COMMIT_REJECTED/);
  assert.match(
    testSources,
    /Inventory JPA ports round-trip claims and dedicated reservation projections @spec:AC-299/,
  );
  assert.doesNotMatch(testSources, /@Disabled|\.skip\(|\.todo\(/);
});

test('Flyway-created Inventory schema validates every JPA mapping @spec:AC-304', async () => {
  const tests = (await sourceTree(testRoot)).map(([, source]) => source).join('\n');
  const application = await readFile(
    'apps/payment-federation/src/main/resources/application.yaml',
    'utf8',
  );

  assert.match(application, /ddl-auto:\s*validate/);
  assert.match(application, /open-in-view:\s*false/);
  assert.match(
    tests,
    /Flyway schema validates all Inventory JPA mappings across restart @spec:AC-304/,
  );
});
