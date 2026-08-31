import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const matrix = await readFile('docs/evidence/challenge-compliance.md', 'utf8');
const readme = await readFile('README.md', 'utf8');

test('AC-109: compliance evidence is anchored to the challenge README @spec:AC-109', async () => {
  const rows = [...matrix.matchAll(/^\| ([^|]+) \| \[([^\]]+)\]\(([^)]+)\) \| (proven|partially proven|not proven|optional) \| \[([^\]]+)\]\(([^)]+)\) \|$/gm)];
  assert.ok(rows.length >= 18, 'matrix must cover objectives, functional, non-functional, and acceptance requirements');
  assert.match(matrix, /challenge README.*source of truth/i);
  assert.doesNotMatch(matrix, /T-\d{3}/, 'compliance evidence must not depend on task references');
  assert.match(readme, /## 2\. Objetivos/);
  assert.match(readme, /## 16\. Requisitos Funcionais/);
  assert.match(readme, /## 17\. Requisitos Não-Funcionais/);
  assert.match(readme, /## 18\. Critérios de Aceitação/);

  for (const [, requirement, sourceLabel, sourceLink, status, evidenceLabel, evidenceLink] of rows) {
    assert.ok(requirement && sourceLabel && evidenceLabel);
    assert.match(sourceLink, /^\.\.\/\.\.\/README\.md#/);
    assert.match(evidenceLink, /^\.\.\/\.\.\/test\/[^)]+\.mjs$/);
    await access(new URL(sourceLink, 'file://' + process.cwd() + '/docs/evidence/').pathname);
    await access(new URL(evidenceLink, 'file://' + process.cwd() + '/docs/evidence/').pathname);
    assert.ok(['proven', 'partially proven', 'not proven', 'optional'].includes(status));
  }
});
