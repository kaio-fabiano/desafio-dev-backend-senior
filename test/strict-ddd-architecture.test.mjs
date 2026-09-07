import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { repositoryApplicationExclusions } from '../tools/architecture/strict-ddd-policy.mjs';
import {
  baselineGrowth,
  inventoryRepository,
  scanFiles,
  scanRepository,
  scanRoots,
  taskManifestScopeViolations,
} from '../tools/architecture/strict-ddd-scanner.mjs';

const fixture = (name) =>
  fileURLToPath(new URL(`./fixtures/strict-ddd/${name}`, import.meta.url));

async function withRepository(files, assertion) {
  const cwd = await mkdtemp(join(tmpdir(), 'strict-ddd-'));
  try {
    for (const [file, source] of Object.entries(files)) {
      const path = join(cwd, file);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, source);
    }
    await assertion(cwd);
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
}

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

test('config exceptions reject multiple exports and accept one vendor configuration export @spec:AC-255', () => {
  assert.deepEqual(scanFiles([fixture('invalid-multi-export.config.ts')]), [
    {
      code: 'invalid-config-exception',
      declaration: 'first',
      file: fixture('invalid-multi-export.config.ts'),
      line: 1,
    },
    {
      code: 'invalid-config-exception',
      declaration: 'second',
      file: fixture('invalid-multi-export.config.ts'),
      line: 2,
    },
  ]);
  assert.deepEqual(scanFiles([fixture('valid-vendor.config.ts')]), []);
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
  const violations = await scanRoots([
    'libs/gateway/nest/src',
    'apps/gateway/src',
  ]);

  assert.deepEqual(violations, []);
});

test('the stable declaration baseline stays empty while the repository baseline cannot grow @spec:AC-259 @spec:AC-261', async () => {
  const baseline = JSON.parse(
    await readFile(
      'tools/architecture/strict-ddd-legacy-baseline.json',
      'utf8',
    ),
  );

  assert.deepEqual(
    baseline.violations.filter(
      ({ code }) => code !== 'unclassified-production',
    ),
    [],
  );
  assert.deepEqual(await scanRepository(), baseline.violations);
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

test('the repository inventory has only the two approved application exclusions @spec:AC-260 @principle:P-006', async () => {
  assert.deepEqual(repositoryApplicationExclusions, [
    'apps/order-workflow-subgraph',
    'apps/payment-federation',
  ]);

  await withRepository(
    {
      'apps/gateway/src/main.ts': 'bootstrap();',
      'apps/order-workflow-subgraph/src/ignored.ts': 'ignored();',
      'apps/payment-federation/src/ignored.java': 'class Ignored {}',
      'apps/wordpress-integration/plugin.php': '<?php',
      'libs/contracts/graphql/schema.graphql': 'type Query { ok: Boolean! }',
      'infra/sst.config.ts': 'export default {};',
      'scripts/check.mjs': 'export default true;',
      'test/gate.test.mjs': "import test from 'node:test';",
      'node_modules/vendor/index.ts': 'dependency();',
      'dist/app.js': 'buildOutput();',
      'coverage/report.json': '{}',
      'libs/gateway/nest/src/generated/client.ts': 'generated();',
    },
    async (cwd) => {
      assert.deepEqual(await inventoryRepository({ cwd }), [
        {
          boundary: 'composition',
          context: 'edge',
          file: 'apps/gateway/src/main.ts',
        },
        {
          boundary: 'wordpress-plugin',
          context: 'commercial',
          file: 'apps/wordpress-integration/plugin.php',
        },
        {
          boundary: 'infrastructure',
          context: 'repository',
          file: 'infra/sst.config.ts',
        },
        {
          boundary: 'contracts',
          context: 'shared',
          file: 'libs/contracts/graphql/schema.graphql',
        },
        {
          boundary: 'scripts',
          context: 'repository',
          file: 'scripts/check.mjs',
        },
        {
          boundary: 'test-tooling',
          context: 'repository',
          file: 'test/gate.test.mjs',
        },
      ]);
    },
  );

  const inventory = await inventoryRepository();
  assert.deepEqual(
    inventory.filter(({ context }) => !context),
    [],
  );
  assert.equal(
    inventory.some(({ file }) =>
      repositoryApplicationExclusions.some(
        (root) => file === root || file.startsWith(`${root}/`),
      ),
    ),
    false,
  );
});

test('unlayered orchestration and unknown production roots fail the repository gate @spec:AC-261 @principle:P-007', async () => {
  await withRepository(
    {
      'apps/catalog/src/catalog.service.ts': 'export class CatalogService {}',
      'libs/identity/nest/src/application/use-cases/register-user.use-case.ts':
        "import { Injectable } from '@nestjs/common'; export class RegisterUserUseCase {}",
      'libs/identity/nest/src/registration/registration.service.ts':
        'export class RegistrationService {}',
      'rogue.service.ts': 'export class RogueService {}',
    },
    async (cwd) => {
      assert.deepEqual(await scanRepository({ cwd }), [
        {
          code: 'unclassified-production',
          declaration: 'missing repository classification',
          file: 'apps/catalog/src/catalog.service.ts',
          line: 1,
        },
        {
          code: 'forbidden-dependency',
          declaration: '@nestjs/common',
          file: 'libs/identity/nest/src/application/use-cases/register-user.use-case.ts',
          line: 1,
        },
        {
          code: 'unclassified-production',
          declaration: 'missing approved layer',
          file: 'libs/identity/nest/src/registration/registration.service.ts',
          line: 1,
        },
        {
          code: 'unclassified-production',
          declaration: 'missing repository classification',
          file: 'rogue.service.ts',
          line: 1,
        },
      ]);
    },
  );
});

test('the migration task manifest rejects both excluded applications @spec:AC-260', async () => {
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
      '## T-216 — Close migration [pendente]\n- Arquivos: apps/order-workflow-subgraph/src/main.ts, apps/payment-federation/src/main.java',
    ),
    [
      {
        code: 'excluded-application',
        declaration: 'apps/order-workflow-subgraph/src/main.ts',
      },
      {
        code: 'excluded-application',
        declaration: 'apps/payment-federation/src/main.java',
      },
    ],
  );
});
