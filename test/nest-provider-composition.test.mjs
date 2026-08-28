import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('@spec:AC-092 NestJS owns shared configuration and lifecycle resources through providers', async () => {
  const [module, environment, resource, index] = await Promise.all([
    source('libs/platform/nest/src/config/config.module.ts'),
    source('libs/platform/nest/src/config/environment.factory.ts'),
    source('libs/platform/nest/src/lifecycle/resource.provider.ts'),
    source('libs/platform/nest/src/index.ts'),
  ]);

  assert.match(module, /Global\(\)\(PlatformConfigModule\)/);
  assert.match(module, /provide: ENVIRONMENT, useFactory: environmentFactory/);
  assert.match(module, /exports: \[ENVIRONMENT\]/);
  assert.match(environment, /Object\.freeze\(\{ \.\.\.environment \}\)/);
  assert.match(resource, /implements OnModuleInit, OnApplicationShutdown/);
  assert.match(resource, /protected abstract create\(\): T \| Promise<T>/);
  assert.match(resource, /await this\.resource\?\.close\(\)/);
  assert.match(index, /PlatformConfigModule/);
  assert.match(index, /ResourceProvider/);
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
  assert.deepEqual(Object.keys(parsedProject.targets).sort(), [
    'build',
    'lint',
    'test',
    'typecheck',
  ]);
  assert.match(parsedProject.targets.test.options.command, /nest-provider-composition/);
  assert.match(tsconfig, /tsconfig\.lib\.json/);
  assert.match(libraryConfig, /src\/\*\*\/\*\.ts/);
});
