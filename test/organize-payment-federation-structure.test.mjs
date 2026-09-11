import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const testRoot = 'apps/payment-federation/src/test/java';

async function javaSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(entries.map(async (entry) => {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) return javaSources(path);
      if (!entry.name.endsWith('.java')) return [];
      return [{ path, source: await readFile(path, 'utf8') }];
    }))
  ).flat();
}

test('AC-321: source paths match Java package declarations @spec:AC-321', async () => {
  const violations = [];
  for (const { path, source } of await javaSources(testRoot)) {
    const packageName = source.match(/^package\s+([\w.]+);/m)?.[1];
    const expected = `${testRoot}/${packageName.replaceAll('.', '/')}/${path.split('/').pop()}`;
    if (path !== expected) violations.push(`${path} -> ${expected}`);
  }
  assert.deepEqual(violations, []);
});

test('AC-322: relocated tests remain present and executable @spec:AC-322', async () => {
  const sources = await javaSources(testRoot);
  assert.ok(sources.length > 0);
  assert.ok(sources.every(({ source }) => source.includes('import org.junit.jupiter.api.Test')));
});
