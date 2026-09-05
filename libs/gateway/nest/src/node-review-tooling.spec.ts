import { Inject, Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { execFile } from 'node:child_process';
import { access, glob, readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const source = (path: string) =>
  readFile(new URL(`../../../../${path}`, import.meta.url), 'utf8');
const globFiles = async (pattern: string) => {
  const files: string[] = [];
  for await (const file of glob(pattern)) files.push(file);
  return files;
};

@Injectable()
class DecoratedProvider {
  constructor(@Inject('value') readonly value: string) {}
}

describe('Node review tooling', () => {
  it('runs each reviewed application through the decorator-capable runtime @spec:AC-225', async () => {
    const projects = await Promise.all(
      [
        'apps/gateway/project.json',
        'apps/identity-subgraph/project.json',
        'apps/order-workflow-subgraph/project.json',
      ].map(source),
    );

    for (const project of projects) {
      expect(project).toContain('node --import tsx');
      expect(project).not.toContain('--experimental-transform-types');
    }
  });

  it('emits runnable JavaScript for each reviewed application build @spec:AC-225', async () => {
    const projects = await Promise.all(
      [
        'apps/gateway/project.json',
        'apps/identity-subgraph/project.json',
        'apps/order-workflow-subgraph/project.json',
      ].map(
        async (path) =>
          JSON.parse(await source(path)) as {
            targets: { build: { options: { command: string } } };
          },
      ),
    );

    for (const project of projects) {
      const command = project.targets.build.options.command;
      expect(command).toContain('--emitDeclarationOnly false');
      expect(command).toContain('--rewriteRelativeImportExtensions');
      expect(command).not.toContain('--noEmit');
    }
  });

  it('emits each reviewed application main module through its Nx build @spec:AC-225', async () => {
    const applications = [
      ['@desafio-dev-backend-senior/gateway', 'gateway'],
      ['@desafio-dev-backend-senior/identity-subgraph', 'identity-subgraph'],
      [
        '@desafio-dev-backend-senior/order-workflow-subgraph',
        'order-workflow-subgraph',
      ],
    ];
    const cwd = new URL('../../../../', import.meta.url);

    await execFileAsync(
      './node_modules/.bin/nx',
      [
        'run-many',
        '--target=build',
        `--projects=${applications.map(([project]) => project).join(',')}`,
        '--skip-nx-cache',
      ],
      { cwd, timeout: 30_000 },
    );

    for (const [, output] of applications) {
      const emitted = new URL(
        `../../../../dist/out-tsc/apps/${output}/src/main.js`,
        import.meta.url,
      );
      await expect(access(emitted)).resolves.toBeUndefined();
      expect(await readFile(emitted, 'utf8')).toMatch(
        /from ["'][^"']+\.js["']/,
      );
    }
  }, 35_000);

  it('declares emitted application outputs and shared build inputs for Nx caching @spec:AC-225', async () => {
    const applications = [
      ['apps/gateway/project.json', 'gateway'],
      ['apps/identity-subgraph/project.json', 'identity-subgraph'],
      ['apps/order-workflow-subgraph/project.json', 'order-workflow-subgraph'],
    ];

    for (const [path, application] of applications) {
      const project = JSON.parse(await source(path)) as {
        targets: { build: { inputs?: string[]; outputs?: string[] } };
      };
      expect(project.targets.build.outputs).toContain(
        `{workspaceRoot}/dist/out-tsc/apps/${application}`,
      );
      expect(project.targets.build.inputs).toEqual(
        expect.arrayContaining([
          'default',
          '{workspaceRoot}/package.json',
          '{workspaceRoot}/pnpm-lock.yaml',
          '{workspaceRoot}/tsconfig.base.json',
        ]),
      );
    }
  });

  it('discovers annotated Vitest specs and keeps identity-owned root tests in its Nx input hash @spec:AC-225', async () => {
    const [config, identity] = await Promise.all([
      source('vitest.config.ts'),
      source('libs/identity/nest/project.json'),
    ]);

    expect(config).toContain(
      "include: ['apps/**/*.spec.ts', 'libs/**/*.spec.ts']",
    );
    expect(identity).toContain(
      '{workspaceRoot}/test/identity-federation-refactor.test.mjs',
    );
  });

  it('makes app and library specs plus production sources visible to the spec runner @spec:AC-225', async () => {
    const config = JSON.parse(await source('onpspec.config.json')) as {
      srcGlobs: string[];
      testGlobs: string[];
    };
    const [appSpecs, librarySpecs, appSources, librarySources] =
      await Promise.all([
        globFiles('apps/**/*.spec.ts'),
        globFiles('libs/**/*.spec.ts'),
        globFiles('apps/**/src/**/*.ts'),
        globFiles('libs/**/src/**/*.ts'),
      ]);

    expect(appSpecs).not.toEqual([]);
    expect(librarySpecs).not.toEqual([]);
    expect(appSources).not.toEqual([]);
    expect(librarySources).not.toEqual([]);
    expect(config.testGlobs).toEqual(
      expect.arrayContaining(['apps/**/*.spec.ts', 'libs/**/*.spec.ts']),
    );
    expect(config.srcGlobs).toEqual(
      expect.arrayContaining(['apps/**/src/**/*.ts', 'libs/**/src/**/*.ts']),
    );
  });

  it('runs and hashes every root test owned by identity-nest @spec:AC-225', async () => {
    const identity = JSON.parse(
      await source('libs/identity/nest/project.json'),
    ) as {
      targets: { test: { inputs: string[]; options: { command: string } } };
    };
    const ownedTests = [
      'test/identity-federation-refactor.test.mjs',
      'test/structural-identity-review.test.mjs',
      'test/oauth-resource-server-auth.spec.test.mjs',
      'test/graphql-relay-dataloader-closure.test.mjs',
      'test/milestone-6-mcp-oauth.test.mjs',
      'test/milestone-8-identity-gateway.test.mjs',
    ];

    for (const test of ownedTests) {
      expect(identity.targets.test.inputs).toContain(`{workspaceRoot}/${test}`);
      expect(identity.targets.test.options.command).toContain(test);
    }
    expect(identity.targets.test.inputs).toContain(
      '{workspaceRoot}/package.json',
    );
    expect(identity.targets.test.inputs).toContain(
      '{workspaceRoot}/pnpm-lock.yaml',
    );
    expect(identity.targets.test.inputs).toContain(
      '{workspaceRoot}/vitest.config.ts',
    );
    expect(identity.targets.test.inputs).toContain(
      '{workspaceRoot}/tsconfig.base.json',
    );
  });

  it('loads workflow decorators in a tsx subprocess and resolves an injected Nest provider @spec:AC-225', async () => {
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        '--import',
        'tsx',
        '-e',
        "import('reflect-metadata').then(() => import('./apps/order-workflow-subgraph/src/health.controller.ts')).then(({ HealthController }) => console.log(Reflect.getMetadata('path', HealthController)))",
      ],
      {
        cwd: new URL('../../../../', import.meta.url),
        env: { ...process.env, TSX_TSCONFIG_PATH: 'tsconfig.base.json' },
      },
    );
    const module = await Test.createTestingModule({
      providers: [DecoratedProvider, { provide: 'value', useValue: 'ready' }],
    }).compile();

    expect(stdout.trim()).toBe('/');
    expect(module.get(DecoratedProvider).value).toBe('ready');
    await module.close();
  });
});
