import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const baselineSpec = await readFile('.spec/features/marco-0-pocs/spec.md', 'utf8');
const constitution = await readFile('.spec/constituicao.md', 'utf8');

test('AC-017: Previous milestone is closed without an inert secret check @spec:AC-017', () => {
  assert.match(baselineSpec, /^> status: auditada$/m);
  assert.match(constitution, /em `apps\/\*\*\/src\/\*\*\/\*\.ts`/);
  assert.doesNotMatch(constitution, /em `src\/\*\*\/\*\.js`/);
});
