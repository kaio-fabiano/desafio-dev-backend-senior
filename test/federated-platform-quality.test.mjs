import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const reviewPath = 'docs/evidence/federated-platform-refactor/review.md';

function reviewContract(review) {
  const match = review.match(
    /<!-- federated-platform-review:start -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- federated-platform-review:end -->/,
  );
  assert.ok(match, 'the architecture review must expose its JSON contract');
  return JSON.parse(match[1]);
}

test('AC-103: quality gates explain and enforce the architecture walkthrough @spec:AC-103', async () => {
  const paths = [
    'README.md',
    'docs/knowledge/Mapa do Projeto.md',
    'docs/runbooks/local-development.md',
    'docs/runbooks/e2e.md',
    reviewPath,
  ];
  const documents = Object.fromEntries(
    await Promise.all(
      paths.map(async (path) => [path, await readFile(path, 'utf8')]),
    ),
  );
  const contract = reviewContract(documents[reviewPath]);

  assert.deepEqual(
    contract.qualityGates.map(({ name }) => name),
    [
      'Project quality',
      'Architecture',
      'Composition',
      'Unit and integration',
      'Coverage',
      'End-to-end',
    ],
  );
  assert.deepEqual(
    contract.runtimes.map(({ name }) => name),
    [
      'Apollo MCP',
      'Gateway',
      'Identity Federation',
      'Payment Federation',
      'WordPress Federation',
    ],
  );

  const evidence = new Set();
  for (const gate of contract.qualityGates) {
    assert.ok(gate.command, `${gate.name} must provide a runnable command`);
    assert.ok(gate.evidence.length > 0, `${gate.name} must link evidence`);
    gate.evidence.forEach((path) => evidence.add(path));
  }
  for (const runtime of contract.runtimes) {
    for (const field of [
      'path',
      'responsibility',
      'providerBoundary',
      'domainDecision',
      'omittedAbstraction',
    ]) {
      assert.ok(runtime[field], `${runtime.name} must document ${field}`);
    }
    assert.ok(
      runtime.evidence.length > 0,
      `${runtime.name} must link evidence`,
    );
    runtime.evidence.forEach((path) => evidence.add(path));
  }
  await Promise.all([...evidence].map((path) => access(path)));

  for (const runtime of contract.runtimes) {
    assert.match(documents['README.md'], new RegExp(runtime.name));
    assert.match(
      documents['docs/knowledge/Mapa do Projeto.md'],
      new RegExp(runtime.name),
    );
  }
  assert.match(
    documents['README.md'],
    /docs\/evidence\/federated-platform-refactor\/review\.md/,
  );
  assert.match(
    documents['docs/runbooks/local-development.md'],
    /quality:nx[\s\S]*architecture-boundaries[\s\S]*quality:coverage/,
  );
  assert.match(
    documents['docs/runbooks/e2e.md'],
    /acceptance:milestone-7[\s\S]*\/graphql\/stream/,
  );
  assert.doesNotMatch(
    contract.qualityGates.map(({ command }) => command).join('\n'),
    /(?:\.skip\b|\btodo\b)/i,
  );
});
