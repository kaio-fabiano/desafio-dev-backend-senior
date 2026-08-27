import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('AC-008: Workspace installs and recognizes the proofs @spec:AC-008', () => {
  const workspace = readFileSync('pnpm-workspace.yaml', 'utf8');
  assert.match(workspace, /onlyBuiltDependencies:/);
  assert.match(workspace, /ignoredBuiltDependencies:/);
  assert.match(workspace, /^\s+- nx$/m);

  const projects = execFileSync('./node_modules/.bin/nx', ['show', 'projects'], {
    encoding: 'utf8',
  });
  assert.match(projects, /@desafio-dev-backend-senior\/e2e/);

  const project = JSON.parse(
    execFileSync(
      './node_modules/.bin/nx',
      ['show', 'project', '@desafio-dev-backend-senior/e2e', '--json'],
      { encoding: 'utf8' },
    ),
  );
  assert.ok(project.targets.acceptance);
});
