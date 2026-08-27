import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const projects = [
  'apps/gateway/project.json',
  'apps/identity-subgraph/project.json',
  'apps/commerce-subgraph/project.json',
  'apps/stock-worker/project.json',
  'apps/payment-processor/project.json',
];

test('AC-074: Nx caches cross-language build and test targets @spec:AC-074', async () => {
  const [nx, pkg, ...definitions] = await Promise.all([
    readJson('nx.json'),
    readJson('package.json'),
    ...projects.map(readJson),
  ]);

  assert.equal(pkg.devDependencies['@nx/gradle'], '23.1.1');
  assert.equal(nx.plugins.some(({ plugin }) => plugin === '@nx/gradle'), true);
  assert.deepEqual(nx.targetDefaults.build, { dependsOn: ['^build'], cache: true });
  assert.equal(nx.targetDefaults.test.cache, true);
  assert.equal(pkg.scripts['quality:nx'], 'nx run-many --target=build,test --all');
  assert.equal(pkg.scripts['quality:affected'], 'nx affected --target=build,test');

  for (const project of definitions) {
    for (const target of ['build', 'test']) {
      assert.equal(project.targets[target].executor, 'nx:run-commands');
    }
  }

  const payment = definitions.at(-1);
  assert.match(payment.targets.build.options.command, /gradle --no-daemon bootJar/);
  assert.match(payment.targets.test.options.command, /gradle --no-daemon test/);
});
