import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('AC-078: acceptance executes the production topology @spec:AC-078', async () => {
  const [environment, project] = await Promise.all([
    readFile('apps/e2e/src/environment.ts', 'utf8'),
    readFile('apps/e2e/project.json', 'utf8'),
  ]);

  for (const component of [
    'gateway',
    'identity-subgraph',
    'order-workflow-subgraph',
    'order-workflow-database',
    'rabbitmq',
    'payment-processor',
    'wordpress',
    'apollo-mcp',
  ]) {
    assert.match(environment, new RegExp(`['"]${component}['"]`));
  }
  const activeServices =
    environment.match(
      /const COMPOSE_SERVICES = \[([\s\S]*?)\] as const/,
    )?.[1] ?? '';
  for (const retired of ['stock-worker']) {
    assert.doesNotMatch(activeServices, new RegExp(`['"]${retired}['"]`));
  }
  assert.match(project, /milestone-7\.e2e\.test\.ts/);
  assert.doesNotMatch(environment, /inline substitute|mock server/i);
});
