import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const app = 'apps/poc-wordpress';
let report;

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: process.env,
    timeout: 10 * 60 * 1000,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

test.before(() => {
  run('bash', [`${app}/scripts/install-plugins.sh`]);
  report = JSON.parse(run(process.execPath, [`${app}/scripts/probe.mjs`]));
});

test('AC-013: WordPress composes into the supergraph @spec:AC-013', () => {
  assert.equal(report.composition.directPlugin.status, 'passed');
  assert.equal(report.composition.normalized, 'passed');
  assert.deepEqual(report.composition.entityKeys, [
    'Product.id',
    'SimpleProduct.id',
    'VariableProduct.id',
    'ExternalProduct.id',
    'GroupProduct.id',
    'Order.id',
  ]);
});

test('AC-014: Critical Woo capabilities have evidence @spec:AC-014', () => {
  assert.equal(report.relay.cursorAdvanced, true);
  assert.deepEqual(report.batching, {
    operation: '_entities',
    representations: 2,
    resolved: 2,
    httpRequests: 1,
    databaseQueries: 1,
  });
  assert.deepEqual(report.ownership, {
    actor: 'vendor-alpha',
    targetOwner: 'vendor-beta',
    rejected: true,
    targetUnchanged: true,
  });
});
