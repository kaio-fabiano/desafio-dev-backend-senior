import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

const app = 'apps/wordpress-integration';

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

test('AC-237: pinned WordPress exposes the complete native GraphQL registration lifecycle @spec:AC-237', () => {
  run('bash', [`${app}/scripts/install-plugins.sh`]);
  const report = JSON.parse(
    run(process.execPath, [`${app}/scripts/probe-registration.mjs`]),
  );

  assert.deepEqual(report.capabilities, {
    createCustomer: true,
    deleteCustomer: true,
    linkSubject: true,
  });
  assert.deepEqual(report.operations, [
    'RegisterIdentityCustomer',
    'LoginIdentityRegistrar',
    'LinkIdentitySubject',
    'LoginLinkedIdentity',
    'DeleteIdentityCustomer',
  ]);
  assert.equal(report.customSchemaRequired, false);
});
