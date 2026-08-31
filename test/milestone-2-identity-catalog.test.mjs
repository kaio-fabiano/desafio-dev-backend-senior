import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('Milestone 2 has one reproducible acceptance command', async () => {
  const [config, runbook] = await Promise.all([
    readFile('onpspec.config.json', 'utf8').then(JSON.parse),
    readFile('docs/runbooks/milestone-2-identity-catalog.md', 'utf8'),
  ]);
  for (const proof of [
    'milestone-2-oauth-bootstrap.test.mjs',
    'milestone-2-token-me.test.mjs',
    'milestone-2-registration.test.mjs',
    'milestone-2-supplier-ownership.test.mjs',
    'milestone-2-catalog-connection.test.mjs',
    'milestone-2-catalog-batching.test.mjs',
  ]) {
    assert.match(config.testCommand, new RegExp(proof.replaceAll('.', '\\.')));
  }
  assert.match(runbook, /onp-spec\.mjs verify milestone-2-identity-catalog/);
  assert.match(runbook, /onp-spec\.mjs audit --ci/);
});
