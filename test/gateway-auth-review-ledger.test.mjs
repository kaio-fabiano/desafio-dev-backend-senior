import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const sourceFiles = [
  'libs/gateway/nest/src/auth/auth-context.factory.ts',
  'libs/gateway/nest/src/auth/token-verifier.service.ts',
  'libs/gateway/nest/src/federation/authenticated-data-source.ts',
  'libs/gateway/nest/src/gateway.module.ts',
];

test('@spec:AC-202 resolved gateway auth review remains complete and discoverable', async () => {
  const ledger = await readFile(
    new URL('docs/reviews/gateway-auth-refactor.md', root),
    'utf8',
  );
  const findingIds = [...ledger.matchAll(/^### Resolved (\d+) —/gm)].map(
    ([, id]) => Number(id),
  );

  assert.deepEqual(
    findingIds,
    Array.from({ length: 20 }, (_, index) => index + 1),
  );
  for (const path of sourceFiles) {
    const source = await readFile(new URL(path, root), 'utf8');
    assert.match(source, /Review: docs\/reviews\/gateway-auth-refactor\.md/);
  }
  assert.equal(
    (ledger.match(/^\*\*Status:\*\* Resolved\./gm) ?? []).length,
    20,
  );
});
