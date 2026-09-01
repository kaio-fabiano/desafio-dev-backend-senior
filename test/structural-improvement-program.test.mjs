import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

test('AC-128: evidence matches the improved topology @spec:AC-128', async () => {
  await access('docs/evidence/structural-improvement-program/review.md');
  const compose = await readFile('compose.yaml', 'utf8');
  const review = await readFile(
    'docs/evidence/structural-improvement-program/review.md',
    'utf8',
  );

  assert.doesNotMatch(compose, /^\s{2}wordpress-(?:subgraph|federation):/m);
  assert.match(review, /native plugin-backed subgraph/);
  assert.match(review, /SST_TOPOLOGY_READY/);
});
