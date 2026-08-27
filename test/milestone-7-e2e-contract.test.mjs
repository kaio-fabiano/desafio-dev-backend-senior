import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const [packageJson, project, environment, journey, acceptance] = await Promise.all([
  readFile('package.json', 'utf8').then(JSON.parse),
  readFile('apps/e2e/project.json', 'utf8').then(JSON.parse),
  readFile('apps/e2e/src/environment.ts', 'utf8'),
  readFile('apps/e2e/src/journey.ts', 'utf8'),
  readFile('apps/e2e/src/milestone-7.e2e.test.ts', 'utf8'),
]);

test('AC-067: one Vitest target owns real Compose startup and unconditional teardown @spec:AC-067', () => {
  assert.equal(packageJson.devDependencies.testcontainers, '11.7.2');
  assert.equal(packageJson.devDependencies.vitest, '3.2.4');
  assert.equal(packageJson.scripts['acceptance:milestone-7'], 'nx run @desafio-dev-backend-senior/e2e:acceptance');
  assert.match(project.targets.acceptance.options.command, /^vitest run apps\/e2e\/src\/milestone-7\.e2e\.test\.ts/);
  assert.match(environment, /DockerComposeEnvironment/);
  assert.match(environment, /\.withBuild\(\)/);
  assert.doesNotMatch(environment, /SERVICE_SOURCE|node', '-e'|createServer|ROLE/);
  for (const component of ['rabbitmq', 'postgres', 'identity-database', 'payment-database', 'wordpress-database', 'wordpress', 'wordpress-setup', 'identity-subgraph', 'commerce-subgraph', 'stock-worker', 'payment-processor', 'gateway', 'apollo-mcp']) {
    assert.match(environment, new RegExp(component.replaceAll('.', '\\.'), 'i'));
  }
  assert.match(environment, /catch \(error\)[\s\S]*await stop\(\)/);
  assert.match(acceptance, /afterAll\(async \(\) => \{[\s\S]*environment\?\.stop\(\)/);
});

test('AC-068..AC-071: the journey crosses only public Gateway and MCP boundaries @spec:AC-068 @spec:AC-069 @spec:AC-070 @spec:AC-071', () => {
  assert.doesNotMatch(journey, /\.\.\/\.\.\/(?:gateway|identity-subgraph|commerce-subgraph|payment-processor|stock-worker)/);
  assert.match(journey, /environment\.gatewayUrl/);
  assert.match(journey, /environment\.mcpUrl/);
  assert.match(journey, /api\/auth\/sign-up\/email/);
  assert.match(journey, /api\/auth\/oauth2\/authorize/);
  assert.match(journey, /api\/auth\/oauth2\/consent/);
  assert.match(journey, /api\/auth\/oauth2\/token/);
  assert.match(journey, /await subscribe\([\s\S]*await graphql\(environment, 'checkout'/);
  assert.match(journey, /cardRetry/);
  assert.match(journey, /rejectionStatuses/);
  for (const criterion of ['AC-068', 'AC-069', 'AC-070', 'AC-071']) {
    assert.match(acceptance, new RegExp(`@spec:${criterion}`));
  }
});
