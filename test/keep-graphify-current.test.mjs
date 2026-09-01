import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('AC-129: canonical Graphify outputs are versioned and freshness is enforced @spec:AC-129', async () => {
  const ignoredCache = spawnSync('git', [
    'check-ignore',
    'graphify-out/cache/stat-index.json',
  ]);
  assert.equal(ignoredCache.status, 0);

  const tracked = execFileSync('git', ['ls-files', 'graphify-out'], {
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter(Boolean);
  assert.deepEqual(tracked.sort(), [
    'graphify-out/GRAPH_REPORT.md',
    'graphify-out/graph.html',
    'graphify-out/graph.json',
    'graphify-out/manifest.json',
  ]);

  const ci = await readFile('.github/workflows/ci.yml', 'utf8');
  assert.match(ci, /pnpm graphify:check/);
  execFileSync(process.execPath, ['scripts/check-graphify-current.mjs']);
});
