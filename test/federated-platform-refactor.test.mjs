import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const adrPath = 'docs/adrs/007-federated-platform-boundaries.md';
const prdPaths = [
  'docs/prds/01-arquitetura-e-dominio.md',
  'docs/prds/02-graphql-federation.md',
  'docs/prds/04-commerce-saga-e-realtime.md',
];

function architectureContract(adr) {
  const match = adr.match(
    /<!-- architecture-contract:start -->\s*```json\s*([\s\S]*?)\s*```\s*<!-- architecture-contract:end -->/,
  );
  assert.ok(match, 'ADR 007 must expose its architecture contract as JSON');
  return JSON.parse(match[1]);
}

test('AC-090: the target contains five deployable applications and one test project @spec:AC-090', async () => {
  const contract = architectureContract(await readFile(adrPath, 'utf8'));

  assert.deepEqual(contract.deployableApplications, [
    { name: 'Apollo MCP', path: 'apps/apollo-mcp' },
    { name: 'Gateway', path: 'apps/gateway' },
    { name: 'Identity Federation', path: 'apps/identity-subgraph' },
    {
      name: 'Order Workflow Federation',
      path: 'apps/order-workflow-subgraph',
    },
    { name: 'Payment Federation', path: 'apps/payment-federation' },
  ]);
  assert.deepEqual(contract.nonDeployableProjects, [
    { name: 'End-to-end tests', path: 'apps/e2e' },
  ]);
  assert.deepEqual(contract.retiredApplications, [
    'apps/stock-worker',
    'apps/wordpress-federation',
  ]);
});

test('AC-103: architecture documentation maps decisions and omissions to executable gates @spec:AC-103', async () => {
  const [adr, rootPackage, ...prds] = await Promise.all([
    readFile(adrPath, 'utf8'),
    readFile('package.json', 'utf8'),
    ...prdPaths.map((path) => readFile(path, 'utf8')),
  ]);

  for (const [index, prd] of prds.entries()) {
    assert.match(prd, /ADR 007/i, `${prdPaths[index]} must reference ADR 007`);
    assert.match(
      prd,
      /## Executable evidence/,
      `${prdPaths[index]} must map evidence`,
    );
  }

  for (const decision of [
    'Runtime inventory',
    'Provider boundary',
    'Domain decision',
    'Deliberately omitted abstractions',
  ]) {
    assert.match(adr, new RegExp(`\\|\\s*${decision}\\s*\\|`));
  }

  assert.match(adr, /test\/architecture-boundaries\.test\.mjs/);
  assert.match(adr, /test\/federated-platform-refactor\.test\.mjs/);
  assert.match(adr, /quality:nx/);
  assert.match(rootPackage, /"quality:nx"/);
  assert.doesNotMatch(adr, /(?:\.skip\b|\btodo\b)/i);
});
