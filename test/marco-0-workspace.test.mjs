import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('AC-008: Workspace installs and recognizes the proofs @spec:AC-008', () => {
  const workspace = readFileSync('pnpm-workspace.yaml', 'utf8');
  assert.match(workspace, /allowBuilds:/);
  assert.match(workspace, /^\s+nx: true$/m);

  const projects = execFileSync('./node_modules/.bin/nx', ['show', 'projects'], {
    encoding: 'utf8',
  });
  assert.match(projects, /@desafio-dev-backend-senior\/poc-harness/);

  const project = JSON.parse(
    execFileSync(
      './node_modules/.bin/nx',
      ['show', 'project', '@desafio-dev-backend-senior/poc-harness', '--json'],
      { encoding: 'utf8' },
    ),
  );
  assert.ok(project.targets['test:spec']);
});
