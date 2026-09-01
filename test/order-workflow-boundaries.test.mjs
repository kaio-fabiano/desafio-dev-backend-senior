import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const workflowRoot = 'apps/order-workflow-subgraph';

test('AC-141: Order Workflow remains an independent focused service @spec:AC-141', async () => {
  const [project, supergraph, compose] = await Promise.all([
    readFile(`${workflowRoot}/project.json`, 'utf8').then(JSON.parse),
    readFile('libs/contracts/graphql/supergraph.yaml', 'utf8'),
    readFile('compose.yaml', 'utf8'),
  ]);

  assert.equal(
    project.name,
    '@desafio-dev-backend-senior/order-workflow-subgraph',
  );
  assert.equal(project.sourceRoot, `${workflowRoot}/src`);
  assert.match(supergraph, /order-workflow:/);
  assert.match(compose, /order-workflow-subgraph:/);
  assert.doesNotMatch(supergraph, /^\s{2}commerce:/m);
  assert.doesNotMatch(compose, /^\s{2}commerce-subgraph:/m);
});

test('AC-142: Order Workflow persists process state, not commerce aggregates @spec:AC-142', async () => {
  const entityRoot = `${workflowRoot}/src/persistence/entities`;
  const files = (await readdir(entityRoot)).filter((file) =>
    file.endsWith('.ts'),
  );
  const entities = await Promise.all(
    files.map((file) => readFile(`${entityRoot}/${file}`, 'utf8')),
  );
  const source = entities.join('\n');

  for (const requiredProcessState of [
    /operationKey/,
    /wooOrderId/,
    /status|state/,
  ]) {
    assert.match(source, requiredProcessState);
  }

  assert.doesNotMatch(source, /class\s+(?:Product|Cart|Customer|Order)\b/);
  assert.doesNotMatch(
    source,
    /@Entity\([^)]*tableName:\s*['"](?:product|cart|customer|order)s?['"]/,
  );
});
