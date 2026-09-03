import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('AC-159: every production gap has an actionable closure contract @spec:AC-159', async () => {
  const [roadmap, risks, index] = await Promise.all([
    readFile('docs/prds/07-roadmap.md', 'utf8'),
    readFile('docs/prds/08-riscos-e-decisoes-pendentes.md', 'utf8'),
    readFile('docs/prds/README.md', 'utf8'),
  ]);
  const register = risks.split('## Production-readiness gap register')[1];
  assert.ok(register, 'the authoritative gap register must exist');

  const rows = register
    .split('\n')
    .filter((line) => /^\| G-\d{3} \|/.test(line))
    .map((line) => line.split('|').slice(1, -1).map((cell) => cell.trim()));
  assert.ok(rows.length >= 8, 'all known production areas must be represented');
  for (const row of rows) {
    assert.equal(row.length, 8, `${row[0]} must provide every closure field`);
    assert.match(row[1], /^P[0-2]$/, `${row[0]} must have a priority`);
    for (const value of row.slice(3)) {
      assert.ok(value.length > 20, `${row[0]} has an incomplete closure field`);
    }
  }

  const areas = new Set(rows.map((row) => row[2]));
  for (const area of [
    'Payment',
    'Infrastructure',
    'WordPress',
    'Messaging',
    'Recovery',
    'Security',
    'Observability',
    'Capacity and quality',
  ]) {
    assert.ok(areas.has(area), `${area} must have an explicit production gap`);
  }

  assert.match(roadmap, /production-readiness gap register/);
  assert.match(index, /authoritative backlog after challenge acceptance/);
});

test('AC-187: the next session resumes from the canonical production backlog @spec:AC-187', async () => {
  const handoff = await readFile('docs/handoffs/next-session.md', 'utf8');

  assert.match(handoff, /80006d8/);
  assert.match(handoff, /G-001[\s\S]*G-002[\s\S]*G-003/);
  assert.match(handoff, /production-readiness gap register/);
  assert.match(handoff, /Mercado Pago sandbox runbook/);
  assert.match(handoff, /credentials[\s\S]*public HTTPS webhook/i);
  assert.match(handoff, /must not be reported\s+as closed/i);
});
