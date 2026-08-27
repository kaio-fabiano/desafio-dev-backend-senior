import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import test from 'node:test';

const execute = promisify(execFile);
const obsoleteRoots = ['apps/poc-auth', 'apps/poc-sse', 'apps/poc-harness'];

test('AC-087: production graph contains no obsolete PoC applications @spec:AC-087', async () => {
  const [tracked, e2eProject, rootPackage, workspace, runbooks] = await Promise.all([
    execute('git', ['ls-files']),
    readFile('apps/e2e/project.json', 'utf8'),
    readFile('package.json', 'utf8'),
    readFile('pnpm-workspace.yaml', 'utf8'),
    Promise.all([
      'docs/runbooks/e2e.md',
      'docs/runbooks/milestone-4-payment-inventory-saga.md',
      'docs/runbooks/milestone-5-subscription-sse.md',
      'docs/runbooks/milestone-6-apollo-mcp.md',
    ].map((path) => readFile(path, 'utf8'))),
  ]);
  const productionSurface = [e2eProject, rootPackage, workspace, ...runbooks].join('\n');

  for (const root of obsoleteRoots) {
    assert.doesNotMatch(tracked.stdout, new RegExp(`^${root}/`, 'm'));
    assert.doesNotMatch(productionSurface, new RegExp(root));
  }

  assert.match(tracked.stdout, /^apps\/wordpress-integration\/project\.json$/m);
  assert.match(e2eProject, /milestone-4-acceptance/);
  assert.match(e2eProject, /milestone-5-acceptance/);
  assert.match(e2eProject, /milestone-6-acceptance/);
  assert.match(rootPackage, /@desafio-dev-backend-senior\/e2e:milestone-7-quality/);
});
