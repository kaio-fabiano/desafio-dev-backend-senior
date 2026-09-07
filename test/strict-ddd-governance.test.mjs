import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const contractPath = 'docs/standards/strict-nestjs-ddd.md';

test('AC-252: the strict DDD contract is explicit @spec:AC-252', async () => {
  const contract = await readFile(contractPath, 'utf8');
  for (const term of [
    'Strategic design and ownership',
    'bounded context',
    'Aggregates protect invariants',
    'Dependency direction and file rules',
    'Narrow exceptions',
    'Required evidence',
  ]) assert.match(contract, new RegExp(term, 'i'), `missing ${term}`);
  assert.match(contract, /versioned contracts or federated references/i);
  assert.match(contract, /Unit tests[\s\S]*integration tests[\s\S]*contract tests[\s\S]*end-to-end tests/i);
});

test('AC-253: agents cannot silently bypass the contract @spec:AC-253', async () => {
  const [agents, constitution, contract] = await Promise.all([
    readFile('AGENTS.md', 'utf8'),
    readFile('.spec/constituicao.md', 'utf8'),
    readFile(contractPath, 'utf8'),
  ]);
  assert.match(agents, /Read `docs\/standards\/strict-nestjs-ddd\.md`/);
  for (const term of ['bounded context', 'use case', 'aggregate', 'invariants', 'consistency boundary', 'affected ports']) {
    const pattern = new RegExp(term.replace(' ', '\\s+'), 'i');
    assert.match(agents, pattern, `AGENTS.md omits ${term}`);
    assert.match(contract, pattern, `contract omits ${term}`);
  }
  assert.match(agents, /not silently\s+bypass/i);
  assert.match(constitution, /P-004.*Strict DDD decisions are explicit before implementation/s);
  assert.match(constitution, /verificação\(teste\): @spec:AC-253/);
});
