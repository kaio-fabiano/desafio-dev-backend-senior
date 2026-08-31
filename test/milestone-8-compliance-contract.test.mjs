import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [matrix, review] = await Promise.all([
  readFile('docs/evidence/milestone-8/requirements.md', 'utf8'),
  readFile('docs/evidence/milestone-8/review.md', 'utf8'),
]);

test('AC-086: compliance matrix has evidence for every mandatory criterion @spec:AC-086', () => {
  const rows = [...matrix.matchAll(/^\|\s*(AC-\d{3})\s*\|[^\n]+\|[^\n]+\|$/gm)];
  assert.deepEqual(
    rows.map(([, id]) => id),
    Array.from(
      { length: 11 },
      (_, i) => `AC-${String(i + 78).padStart(3, '0')}`,
    ),
  );
  for (const row of rows) assert.match(row[0], /\[[^\]]+\]\([^\)]+\)/);
});

test('AC-087: review records completed runtime evidence @spec:AC-087', () => {
  assert.match(review, /final acceptance journey passed/i);
  assert.match(review, /all six scenarios/);
  assert.doesNotMatch(matrix, /pending T-/);
  assert.doesNotMatch(matrix, /\| pending/);
  assert.match(matrix, /no separate Stock worker/i);
});
