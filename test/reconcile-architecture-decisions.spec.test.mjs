import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const registerPath = 'docs/prds/08-riscos-e-decisoes-pendentes.md';

function decisionRow(register, id) {
  const row = register
    .split('\n')
    .find((line) => line.startsWith(`| ${id} `));
  assert.ok(row, `${id} must exist in the prioritized decision register`);
  return row;
}

test('AC-185: completed architecture decisions cite executable evidence @spec:AC-185', async () => {
  const register = await readFile(registerPath, 'utf8');

  for (const id of ['D-001', 'D-002', 'D-003', 'D-011']) {
    assert.match(decisionRow(register, id), /proved|closed/i);
  }

  assert.match(register, /D-001[\s\S]*test\/marco-0-sse\.test\.mjs/);
  assert.match(register, /D-002[\s\S]*test\/oauth-resource-server-auth\.spec\.test\.mjs/);
  assert.match(register, /D-003[\s\S]*test\/marco-0-wordpress\.test\.mjs/);
  assert.match(register, /D-011[\s\S]*test\/production-happy-path-hardening\.spec\.test\.js/);
});

test('AC-186: decision closure preserves external production gaps @spec:AC-186', async () => {
  const register = await readFile(registerPath, 'utf8');

  assert.match(register, /Passing challenge acceptance proves the delivered behavior, not production\s+readiness/);
  for (const gap of ['G-001', 'G-002', 'G-003']) {
    assert.match(register, new RegExp(`\\| ${gap} \\| P0 \\|`));
  }
  assert.match(decisionRow(register, 'D-004'), /sandbox pending/i);
});
