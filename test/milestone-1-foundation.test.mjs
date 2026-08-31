import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const node = process.execPath;
const contractTests = [
  'test/milestone-1-baseline.test.mjs',
  'test/milestone-1-boundaries.test.mjs',
  'test/milestone-1-health.test.mjs',
  'test/milestone-1-graphql-contracts.test.mjs',
  'test/milestone-1-events.test.mjs',
];

test('AC-023: One command proves the foundation gate @spec:AC-023', async () => {
  const [runbook, config] = await Promise.all([
    readFile('docs/runbooks/milestone-1-foundation.md', 'utf8'),
    readFile('onpspec.config.json', 'utf8'),
  ]);
  const command = JSON.parse(config).testCommand;
  const foundationCommand = command.split(' && node --experimental-transform-types')[0];
  assert.match(
    runbook,
    new RegExp(foundationCommand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  );

  const nx = fileURLToPath(import.meta.resolve('nx/bin/nx.js'));
  const { stdout: projects } = await run(node, [nx, 'show', 'projects']);
  for (const project of ['@desafio-dev-backend-senior/gateway', '@desafio-dev-backend-senior/identity-subgraph', '@desafio-dev-backend-senior/commerce-subgraph']) {
    assert.match(projects, new RegExp(project));
  }

  await run(node, ['--test', '--test-reporter=tap', ...contractTests], { timeout: 60_000 });
});
