import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const legacyPaths = [
  '.spec/features/marco-0-pocs',
  '.spec/verification/marco-0-pocs.json',
  'test/marco-0-workspace.test.mjs',
  'test/marco-0-sse.test.mjs',
  'test/marco-0-auth.test.mjs',
  'test/marco-0-wordpress.test.mjs',
  'test/marco-0-decisions.test.mjs',
  'test/marco-0-pocs.spec.test.js',
  'test/fixtures/auth-probe.ts',
  'test/fixtures/auth-resource-servers.ts',
  'test/fixtures/federated-sse-gateway.ts',
  'test/fixtures/federated-sse-probe.ts',
  'test/fixtures/federated-sse-subgraph.ts',
];

test('AC-277: completed Milestone Zero evidence is historical @spec:AC-277', async () => {
  for (const path of legacyPaths) {
    await assert.rejects(
      access(path),
      { code: 'ENOENT' },
      `${path} still exists`,
    );
  }

  await access('test/fixtures/auth-server.ts');
  const decisions = await Promise.all(
    [
      'docs/adrs/001-graphql-sse-federado.md',
      'docs/adrs/002-oauth-multi-resource.md',
      'docs/adrs/003-wordpress-federation.md',
    ].map((path) => readFile(path, 'utf8')),
  );
  const register = await readFile(
    'docs/prds/08-riscos-e-decisoes-pendentes.md',
    'utf8',
  );

  for (const [index, decision] of decisions.entries()) {
    assert.match(decision, /Status: accepted/);
    assert.match(register, new RegExp(`\\| D-00${index + 1} \\|`));
  }
});

test('AC-278: default tests avoid the heavy WordPress compatibility probe @spec:AC-278', async () => {
  const project = JSON.parse(
    await readFile('apps/wordpress-integration/project.json', 'utf8'),
  );
  const packageManifest = JSON.parse(
    await readFile('apps/wordpress-integration/package.json', 'utf8'),
  );

  assert.equal(project.targets.test, undefined);
  assert.equal(packageManifest.scripts.test, undefined);
  assert.equal(
    project.targets.acceptance.options.command,
    'bash apps/wordpress-integration/scripts/install-plugins.sh && node apps/wordpress-integration/scripts/probe.mjs',
  );
  assert.equal(
    packageManifest.scripts.acceptance,
    'bash scripts/install-plugins.sh && node scripts/probe.mjs',
  );
});

test('AC-279: current behavior owns current regression evidence @spec:AC-279', async () => {
  const [
    sse,
    oauth,
    wordpress,
    register,
    reconciliation,
    milestone,
    registration,
  ] = await Promise.all(
    [
      'docs/adrs/001-graphql-sse-federado.md',
      'docs/adrs/002-oauth-multi-resource.md',
      'docs/adrs/003-wordpress-federation.md',
      'docs/prds/08-riscos-e-decisoes-pendentes.md',
      'test/reconcile-architecture-decisions.spec.test.mjs',
      '.spec/features/milestone-8-compliance-hardening/tasks.md',
      '.spec/features/refactor-registration-boundaries/tasks.md',
    ].map((path) => readFile(path, 'utf8')),
  );
  const activeEvidence = [
    sse,
    oauth,
    wordpress,
    register,
    reconciliation,
    milestone,
    registration,
  ].join('\n');

  assert.doesNotMatch(activeEvidence, /test\/marco-0-|marco-0-pocs/);
  assert.match(
    sse,
    /apps\/order-workflow-subgraph\/src\/graphql\/sse\/sse\.integration\.spec\.ts/,
  );
  assert.match(oauth, /test\/oauth-resource-server-auth\.spec\.test\.mjs/);
  assert.match(
    wordpress,
    /test\/remove-wordpress-federation-runtime\.spec\.test\.mjs/,
  );
  assert.match(
    wordpress,
    /test\/wordpress-registration-graphql\.contract\.test\.mjs/,
  );
  assert.match(
    register,
    /test\/production-happy-path-hardening\.spec\.test\.js/,
  );
});
