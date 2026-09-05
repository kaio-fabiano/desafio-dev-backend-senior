import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(path, 'utf8');

test('AC-216: official NestJS configuration is active in every application @spec:AC-216', async () => {
  const roots = await Promise.all([
    source('apps/gateway/src/app.module.ts'),
    source('apps/identity-subgraph/src/app.module.ts'),
    source('apps/order-workflow-subgraph/src/app.module.ts'),
  ]);

  for (const root of roots) {
    assert.match(root, /from '@nestjs\/config'/);
    assert.match(root, /ConfigModule\.forRoot\(\{[\s\S]*isGlobal: true/);
    assert.match(root, /cache: true/);
  }
});

test('AC-217: bootstrap ports preserve their environment contract through dependency injection @spec:AC-217', async () => {
  const bootstraps = await Promise.all([
    source('apps/gateway/src/main.ts'),
    source('apps/identity-subgraph/src/main.ts'),
    source('apps/order-workflow-subgraph/src/main.ts'),
  ]);

  for (const bootstrap of bootstraps) {
    assert.match(bootstrap, /app\.get\(ConfigService\)/);
    assert.match(bootstrap, /Number\(config\.get\('PORT', '3000'\)\)/);
    assert.doesNotMatch(bootstrap, /process\.env\.PORT/);
  }
});

test('AC-218: custom environment plumbing is removed @spec:AC-218', async () => {
  const publicApi = await source('libs/platform/nest/src/index.ts');
  assert.doesNotMatch(
    publicApi,
    /PlatformConfigModule|ENVIRONMENT|environmentFactory|Environment/,
  );

  for (const path of [
    'libs/platform/nest/src/config/config.module.ts',
    'libs/platform/nest/src/config/environment.factory.ts',
    'libs/platform/nest/src/config/environment.factory.spec.ts',
  ]) {
    await assert.rejects(access(path));
  }
});
