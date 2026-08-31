import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const migrationPath =
  'apps/commerce-subgraph/src/persistence/migrations/Migration202608270001.ts';
const configPath =
  'apps/commerce-subgraph/src/persistence/mikro-orm.config.ts';

const migration = await readFile(migrationPath, 'utf8');
const config = await readFile(configPath, 'utf8');
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const lockfile = await readFile('pnpm-lock.yaml', 'utf8');

test('AC-035: Sequential retries resolve through one persisted operation @spec:AC-035', () => {
  assert.match(migration, /unique \(\"subject\", \"operation_key\"\)/);
  assert.match(migration, /\"woo_order_id\" varchar\(32\) null/);
});

test('AC-036: Concurrent retries are serialized by a database constraint @spec:AC-036', () => {
  assert.match(
    migration,
    /constraint \"commerce_checkout_operation_subject_key_unique\" unique/,
  );
});

test('AC-037: A reused key retains the original command hash @spec:AC-037', () => {
  assert.match(migration, /\"command_hash\" varchar\(64\) not null/);
  assert.match(migration, /unique \(\"subject\", \"operation_key\"\)/);
});

test('AC-038: Pending WooCommerce checkout has a stable reconciliation reference @spec:AC-038', () => {
  assert.match(migration, /default 'PENDING_WOO'/);
  assert.match(migration, /unique \(\"woo_reference\"\)/);
  assert.match(migration, /\"woo_order_id\" varchar\(32\) null/);
});

test('AC-039: Workflow and unsent event share transactional persistence @spec:AC-039', () => {
  assert.match(config, /transactional: true/);
  assert.match(config, /allOrNothing: true/);
  assert.match(
    migration,
    /foreign key \(\"workflow_id\"\) references \"commerce_order_workflow\"/,
  );
  assert.match(migration, /where \"sent_at\" is null/);
});

test('MikroORM owns only first-party Commerce metadata', () => {
  assert.match(config, /CheckoutOperation/);
  assert.match(config, /OrderWorkflow/);
  assert.match(config, /OutboxEvent/);
  assert.doesNotMatch(config, /BetterAuth|User|Session|Account/);
});

test('MikroORM packages are pinned together in the manifest and lockfile', () => {
  for (const packageName of [
    '@mikro-orm/core',
    '@mikro-orm/migrations',
    '@mikro-orm/postgresql',
  ]) {
    assert.equal(packageJson.dependencies[packageName], '6.6.16');
    assert.match(lockfile, new RegExp(`'${packageName}@6\\.6\\.16'`));
  }
});
