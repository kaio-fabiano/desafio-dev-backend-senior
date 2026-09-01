import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');

test('AC-116: final records describe the delivered runtime @spec:AC-116', () => {
  const readme = read('README.md');
  const evidence = read('docs/evidence/challenge-compliance.md');
  const requirements = read('docs/evidence/milestone-8/requirements.md');
  const deadline = read('docs/adrs/004-restricoes-de-entrega.md');
  const boundaries = read('docs/adrs/007-federated-platform-boundaries.md');
  const tasks = read('.spec/features/delivery-closure/tasks.md');
  const compose = read('compose.yaml');

  assert.doesNotMatch(evidence, /\| (?:partially proven|not proven) \|/);
  assert.doesNotMatch(requirements, /pending T-/);
  assert.match(deadline, /2026-09-03/);
  assert.match(deadline, /date only/);
  assert.match(readme, /five deployable applications/);
  assert.match(boundaries, /"name": "Order Workflow Federation"/);
  assert.match(
    boundaries,
    /"retiredApplications": \["apps\/stock-worker", "apps\/wordpress-federation"\]/,
  );
  assert.match(tasks, /T-090[^\n]*\[concluida\]/);
  assert.match(compose, /^  order-workflow-subgraph:/m);
  assert.match(compose, /^  rabbitmq:/m);
  assert.match(compose, /^  payment-processor:/m);
  assert.doesNotMatch(compose, /^  stock-worker:/m);
  assert.equal(
    existsSync('apps/wordpress-integration/marketplace-inventory.php'),
    false,
  );
});
