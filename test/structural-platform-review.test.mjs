import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('AC-127: shared platform deployment paths fail closed @spec:AC-127', async () => {
  const ci = await readFile('.github/workflows/ci.yml', 'utf8');
  const deploy = await readFile('.github/workflows/deploy.yml', 'utf8');

  assert.doesNotMatch(ci, /milestone-[45]-acceptance|stock-worker/);
  assert.match(ci, /acceptance:milestone-7/);
  assert.match(deploy, /SST_TOPOLOGY_READY == 'true'/);
});
