import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('@spec:AC-092 NestJS owns shared configuration through providers', async () => {
  const [gateway, identity, orderWorkflow] = await Promise.all([
    source('apps/gateway/src/app.module.ts'),
    source('apps/identity-subgraph/src/app.module.ts'),
    source('apps/order-workflow-subgraph/src/app.module.ts'),
  ]);

  for (const root of [gateway, identity, orderWorkflow]) {
    assert.match(root, /ConfigModule\.forRoot/);
  }
});

test('@spec:AC-219 unused lifecycle abstractions are absent from platform-nest', async () => {
  const index = await source('libs/platform/nest/src/index.ts');

  await assert.rejects(
    source('libs/platform/nest/src/lifecycle/resource.provider.ts'),
    { code: 'ENOENT' },
  );
  assert.doesNotMatch(index, /ResourceProvider|ManagedResource/);
});

test('@spec:AC-103 Nx quality gates enforce the reusable NestJS composition boundary', async () => {
  const [project, tsconfig, libraryConfig] = await Promise.all([
    source('libs/platform/nest/project.json'),
    source('libs/platform/nest/tsconfig.json'),
    source('libs/platform/nest/tsconfig.lib.json'),
  ]);

  const parsedProject = JSON.parse(project);
  assert.equal(parsedProject.projectType, 'library');
  assert.deepEqual(parsedProject.tags, ['type:lib', 'scope:platform']);
  for (const target of [
    'build',
    'contract',
    'coverage',
    'lint',
    'test',
    'test-typecheck',
    'typecheck',
    'unit',
  ]) {
    assert.ok(parsedProject.targets[target], `missing ${target} target`);
  }
  assert.match(
    parsedProject.targets.test.options.commands.join('\n'),
    /nest-provider-composition/,
  );
  assert.match(tsconfig, /tsconfig\.lib\.json/);
  assert.match(libraryConfig, /src\/\*\*\/\*\.ts/);
});
