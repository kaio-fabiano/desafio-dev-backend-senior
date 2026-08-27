import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { promisify } from 'node:util';

const run = promisify(execFile);
const project = `milestone-1-${randomUUID().slice(0, 8)}`;
const compose = ['compose', '--project-name', project, '--file', 'compose.yaml'];

test('AC-022: Local infrastructure becomes ready @spec:AC-022', async () => {
  try {
    await run('docker', [...compose, 'up', '--detach', '--wait'], { timeout: 90_000 });

    for (const [service, port] of [
      ['gateway', 3000],
      ['identity-subgraph', 3001],
      ['commerce-subgraph', 3003],
    ]) {
      const { stdout } = await run('docker', [
        ...compose,
        'exec',
        '--no-TTY',
        service,
        'node',
        '-e',
        `fetch('http://127.0.0.1:${port}/ready').then(async response => { const body = await response.json(); if (!response.ok || body.status !== 'ready') process.exit(1); })`,
      ]);
      assert.equal(stdout, '');
    }
  } finally {
    await run('docker', [...compose, 'down', '--volumes'], { timeout: 30_000 }).catch(() => {});
  }
});
