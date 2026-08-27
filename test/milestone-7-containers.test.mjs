import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const applications = [
  'gateway',
  'identity-subgraph',
  'commerce-subgraph',
  'stock-worker',
  'payment-processor',
  'apollo-mcp',
];

test('@spec:AC-075 production application images are pinned, multi-stage, and non-root', async () => {
  for (const application of applications) {
    const dockerfile = await readFile(`apps/${application}/Dockerfile`, 'utf8');
    assert.match(dockerfile, /^FROM .+:.+ AS .+$/m, `${application} needs a pinned build stage`);
    assert.match(dockerfile, /^FROM .+:.+ AS runtime$/m, `${application} needs a pinned runtime stage`);
    assert.match(dockerfile, /^USER .+$/m, `${application} runtime must not use root`);
  }
});

test('@spec:AC-075 Compose builds application images and waits for healthchecks', async () => {
  const compose = await readFile('compose.yaml', 'utf8');
  for (const application of applications) {
    assert.match(compose, new RegExp(`  ${application}:\\n(?:.|\\n)*?healthcheck:`, 'm'));
  }
  assert.doesNotMatch(compose, /image: node:/);
  assert.doesNotMatch(compose, /- \.:\/workspace/);
  assert.match(compose, /condition: service_healthy/);
  assert.match(compose, /apollo-mcp:[\s\S]*?127\.0\.0\.1:8000\/health/);
  assert.doesNotMatch(compose, /127\.0\.0\.1:8000\/mcp/);
});
