import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const applications = [
  'gateway',
  'identity-subgraph',
  'payment-federation',
  'apollo-mcp',
];

test('@spec:AC-075 production application images are pinned, multi-stage, and non-root', async () => {
  for (const application of ['payment-federation', 'apollo-mcp']) {
    const dockerfile = await readFile(`apps/${application}/Dockerfile`, 'utf8');
    assert.match(dockerfile, /^FROM .+:.+ AS .+$/m, `${application} needs a pinned build stage`);
    assert.match(dockerfile, /^FROM .+:.+ AS runtime$/m, `${application} needs a pinned runtime stage`);
    assert.match(dockerfile, /^USER .+$/m, `${application} runtime must not use root`);
  }
  const compose = await readFile('compose.yaml', 'utf8');
  const sharedBuild = compose.split('\nservices:')[0];
  assert.match(sharedBuild, /^    FROM node:24\.19\.0-bookworm-slim AS dependencies$/m);
  assert.match(sharedBuild, /^    FROM node:24\.19\.0-bookworm-slim AS runtime$/m);
  assert.match(sharedBuild, /^    USER app$/m);
});

test('@spec:AC-075 Compose builds application images and waits for healthchecks', async () => {
  const compose = await readFile('compose.yaml', 'utf8');
  for (const application of applications) {
    assert.match(compose, new RegExp(`  ${application}:\\n(?:.|\\n)*?healthcheck:`, 'm'));
  }
  assert.doesNotMatch(compose, /image: node:/);
  assert.doesNotMatch(compose, /- \.:\/workspace/);
  assert.match(compose, /condition: service_healthy/);
  const apollo = compose.match(/^  apollo-mcp:\n([\s\S]*?)(?=^  [\w-]+:\n)/m)?.[0] ?? '';
  for (const argument of [
    "'CMD'",
    "'/bin/wget'",
    "'--quiet'",
    "'--spider'",
    "'http://127.0.0.1:8000/health'",
  ]) {
    assert.match(apollo, new RegExp(argument.replaceAll('/', '\\/')));
  }
  assert.doesNotMatch(apollo, /127\.0\.0\.1:8000\/mcp/);
  assert.doesNotMatch(apollo, /CMD-SHELL/);
});
