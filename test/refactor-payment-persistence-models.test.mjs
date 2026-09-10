import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const productionRoot = 'apps/payment-federation/src/main/java';

async function javaSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const path = `${directory}/${entry.name}`;
        return entry.isDirectory()
          ? javaSources(path)
          : entry.name.endsWith('.java')
            ? [[path, await readFile(path, 'utf8')]]
            : [];
      }),
    )
  ).flat();
}

test('Payment Federation runtime uses ORM without handwritten SQL @spec:AC-303', async () => {
  const [sources, build] = await Promise.all([
    javaSources(productionRoot),
    readFile('apps/payment-federation/build.gradle.kts', 'utf8'),
  ]);
  const violations = sources.filter(
    ([path, source]) =>
      /\/Jdbc[^/]*\.java$/.test(path) ||
      /JdbcTemplate|java\.sql|nativeQuery\s*=|createNativeQuery\s*\(/.test(source) ||
      /(?:insert\s+into|delete\s+from|create\s+table|alter\s+table|(?:select|update)\s+[^;]*\b(?:payment|inventory|transaction|public)\.)/is.test(
        source,
      ),
  );

  assert.deepEqual(violations.map(([path]) => path), []);
  assert.doesNotMatch(build, /spring-boot-starter-jdbc/);
});
