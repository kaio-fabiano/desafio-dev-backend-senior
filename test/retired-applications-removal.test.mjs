import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import test from 'node:test';

const execute = promisify(execFile);
const retiredRoots = [
  'apps/stock-worker',
  'apps/poc-auth',
  'apps/poc-sse',
  'apps/poc-harness',
];

test('AC-104: retired application roots no longer exist @spec:AC-104', async () => {
  const projects = JSON.parse(
    (await execute('pnpm', ['exec', 'nx', 'show', 'projects'])).stdout,
  );

  for (const root of retiredRoots) {
    await assert.rejects(access(root));
  }
  assert.ok(projects.includes('@desafio-dev-backend-senior/commerce-subgraph'));
  assert.equal(
    projects.some((project) => /stock-worker/.test(project)),
    false,
  );
});

test('AC-105: active automation has no retired source dependency @spec:AC-105', async () => {
  const activeFiles = [
    'apps/e2e/project.json',
    'compose.yaml',
    'infra/sst.config.ts',
    'onpspec.config.json',
    'package.json',
  ];
  const sources = (
    await Promise.all(activeFiles.map((file) => readFile(file, 'utf8')))
  ).join('\n');

  assert.doesNotMatch(sources, /apps\/stock-worker/);
  assert.doesNotMatch(sources, /StockWorker/);
  assert.match(sources, /commerce-subgraph/);
});

test('AC-106: supported project gates remain executable @spec:AC-106', async () => {
  const [rootPackage, e2eProject] = await Promise.all([
    readFile('package.json', 'utf8').then(JSON.parse),
    readFile('apps/e2e/project.json', 'utf8').then(JSON.parse),
  ]);

  assert.equal(
    rootPackage.scripts['quality:nx'],
    'nx run-many --target=build,typecheck,lint,test --all',
  );
  assert.ok(e2eProject.targets.acceptance);
  assert.ok(e2eProject.targets['milestone-7-quality']);
});
