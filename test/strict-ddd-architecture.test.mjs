import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { strictDddRoots } from '../tools/architecture/strict-ddd-policy.mjs';
import {
  baselineGrowth,
  scanFiles,
  scanRoots,
  taskManifestScopeViolations,
} from '../tools/architecture/strict-ddd-scanner.mjs';

const fixture = (name) =>
  fileURLToPath(new URL(`./fixtures/strict-ddd/${name}`, import.meta.url));

test('mixed production declarations report their file and declaration @spec:AC-254', () => {
  const violations = scanFiles([fixture('invalid-mixed-service.ts')]);

  assert.deepEqual(violations, [
    {
      code: 'mixed-declaration',
      declaration: 'DEFAULT_PAGE_SIZE',
      file: fixture('invalid-mixed-service.ts'),
      line: 1,
    },
  ]);
});

test('only dedicated framework files receive functional exceptions @spec:AC-255', () => {
  assert.deepEqual(scanFiles([fixture('valid-custom.decorator.ts')]), []);
});

test('domain and application layers reject framework dependencies @spec:AC-256', () => {
  const violations = scanFiles(
    [
      {
        file: 'libs/identity/nest/src/domain/entities/user.entity.ts',
        source:
          "import { Injectable } from '@nestjs/common'; export class UserEntity {}",
      },
    ],
    { cwd: process.cwd() },
  );

  assert.deepEqual(violations, [
    {
      code: 'forbidden-dependency',
      declaration: '@nestjs/common',
      file: 'libs/identity/nest/src/domain/entities/user.entity.ts',
      line: 1,
    },
  ]);
});

test('focused classes and abstract ports are accepted @spec:AC-257', () => {
  assert.deepEqual(scanFiles([fixture('valid-use-case.ts')]), []);
  assert.deepEqual(
    scanFiles([
      {
        file: 'libs/identity/nest/src/application/ports/identity.port.ts',
        source: 'export abstract class IdentityPort {}',
      },
    ]),
    [],
  );
});

test('Gateway has no remaining legacy declarations after its migration wave @spec:AC-256 @spec:AC-257 @spec:AC-258', async () => {
  const violations = await scanRoots(
    ['libs/gateway/nest/src', 'apps/gateway/src'],
  );

  assert.deepEqual(violations, []);
});

test('the stable NestJS baseline accepts only existing violations', async () => {
  const baseline = JSON.parse(
    await readFile(
      'tools/architecture/strict-ddd-legacy-baseline.json',
      'utf8',
    ),
  );

  assert.deepEqual(
    baselineGrowth(await scanRoots(strictDddRoots), baseline),
    [],
  );
  assert.deepEqual(
    baselineGrowth(scanFiles([fixture('invalid-mixed-service.ts')]), baseline),
    [
      {
        code: 'mixed-declaration',
        declaration: 'DEFAULT_PAGE_SIZE',
        file: fixture('invalid-mixed-service.ts'),
        line: 1,
      },
    ],
  );
});

test('the migration task manifest excludes Order Workflow', async () => {
  assert.deepEqual(
    taskManifestScopeViolations(
      await readFile(
        '.spec/features/strict-nestjs-ddd-migration/tasks.md',
        'utf8',
      ),
    ),
    [],
  );
  assert.deepEqual(
    taskManifestScopeViolations(
      '- Arquivos: apps/order-workflow-subgraph/src/main.ts',
    ),
    [
      {
        code: 'excluded-order-workflow',
        declaration: 'apps/order-workflow-subgraph/src/main.ts',
      },
    ],
  );
});
