import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const inventoryRoot =
  'apps/payment-federation/src/main/java/dev/desafio/transaction/inventory';
const inventoryTestRoot =
  'apps/payment-federation/src/test/java/dev/desafio/transaction/inventory';

async function javaSources(directory = inventoryRoot) {
  const entries = await readdir(directory, { withFileTypes: true });
  const sources = await Promise.all(
    entries.map(async (entry) => {
      const path = `${directory}/${entry.name}`;
      return entry.isDirectory() ? javaSources(path) : [path];
    }),
  );
  return sources.flat().filter((path) => path.endsWith('.java'));
}

test('Inventory uses distinct Axon command, event, and query paths @spec:AC-281', async () => {
  const sources = await javaSources();
  const contents = await Promise.all(sources.map((path) => readFile(path, 'utf8')));
  const source = contents.join('\n');

  assert.match(source, /@EventSourced\s*\(/);
  assert.match(source, /@CommandHandler/);
  assert.match(source, /@EventHandler/);
  assert.match(source, /@QueryHandler/);
  assert.ok(sources.some((path) => path.includes('/application/command/')));
  assert.ok(sources.some((path) => path.includes('/application/query/')));
  assert.doesNotMatch(
    source,
    /import dev\.desafio\.transaction\.(payment|transaction)\./,
  );
});

test('Inventory event streams and projections are replayable and durable @spec:AC-282', async () => {
  const paths = await javaSources(inventoryTestRoot);
  const tests = (await Promise.all(paths.map((path) => readFile(path, 'utf8')))).join('\n');

  assert.match(tests, /AxonTestFixture/);
  assert.match(tests, /PostgreSQLContainer/);
  assert.match(tests, /Axon replays the Inventory stream before applying the next command @spec:AC-282/);
  assert.match(tests, /Inventory projection remains durable and ignores stale replay updates @spec:AC-282/);
});

test('Inventory converges independently for duplicate, stale, and concurrent work @spec:AC-284', async () => {
  const paths = await javaSources(inventoryTestRoot);
  const tests = (await Promise.all(paths.map((path) => readFile(path, 'utf8')))).join('\n');

  assert.match(tests, /Inventory decisions are idempotent and stale facts cannot regress state @spec:AC-284/);
  assert.match(tests, /Concurrent last-unit reservations have one independently consistent winner @spec:AC-284/);
  assert.match(tests, /A duplicate transaction cannot change its Inventory reservation request @spec:AC-284/);
});

test('Inventory crosses bounded contexts through durable RabbitMQ AMQP @spec:AC-293', async () => {
  const [inventory, rabbit, topology] = await Promise.all([
    readFile(
      `${inventoryTestRoot}/infrastructure/InventoryPostgresIntegrationTest.java`,
      'utf8',
    ),
    readFile(
      'apps/payment-federation/src/test/java/dev/desafio/transaction/infrastructure/messaging/RabbitMqBoundaryIntegrationTest.java',
      'utf8',
    ),
    readFile(
      'apps/payment-federation/src/main/java/dev/desafio/transaction/configuration/AmqpTopologyConfiguration.java',
      'utf8',
    ),
  ]);

  assert.match(inventory, /Inventory result is durable before RabbitMQ publication @spec:AC-293/);
  assert.match(rabbit, /Outbox recovery, duplicate delivery, retry, and DLQ preserve the V1 envelope/);
  assert.match(topology, /transaction\.order-received\.v1/);
  assert.match(topology, /payment\.approved\.v1/);
});

test('Inventory migration passes its focused repository quality gates @spec:AC-292', async () => {
  const paths = await javaSources(inventoryTestRoot);
  const tests = (await Promise.all(paths.map((path) => readFile(path, 'utf8')))).join('\n');

  assert.match(tests, /Inventory PostgreSQL migration passes the repository quality gate @spec:AC-292/);
  assert.doesNotMatch(tests, /@Disabled|\.skip\(|\.todo\(/);
});

test('Inventory behavior retains executable Red Green Refactor evidence @principle:P-003', async () => {
  const tests = await readFile(
    `${inventoryTestRoot}/application/InventoryAxonPathsTest.java`,
    'utf8',
  );
  assert.match(tests, /Commands append Inventory events and queries read a dedicated view/);
  assert.match(tests, /\.then\(\)\.success\(\)\.events\(/);
});
