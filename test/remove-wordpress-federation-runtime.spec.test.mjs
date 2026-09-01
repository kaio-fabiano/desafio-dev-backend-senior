import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

async function exists(path) {
  return access(path).then(
    () => true,
    () => false,
  );
}

// US-059 — Compose WordPress directly
test('AC-117: Direct plugin subgraph @spec:AC-117 @spec:AC-097', async () => {
  const [gateway, supergraph, compose] = await Promise.all([
    readFile('libs/gateway/nest/src/gateway.module.ts', 'utf8'),
    readFile('libs/contracts/graphql/supergraph.yaml', 'utf8'),
    readFile('compose.yaml', 'utf8'),
  ]);

  assert.match(gateway, /http:\/\/wordpress\/graphql/);
  assert.match(supergraph, /routing_url: http:\/\/wordpress\/graphql/);
  assert.doesNotMatch(compose, /^  wordpress-federation:/m);
  assert.equal(await exists('apps/wordpress-federation'), false);
});

// US-059 — Compose WordPress directly
test('AC-118: Single subscription owner @spec:AC-118 @spec:AC-102', async () => {
  const [gatewayMiddleware, gatewaySse] = await Promise.all([
    readFile('apps/gateway/src/subscriptions/sse.middleware.ts', 'utf8'),
    readFile('apps/gateway/src/subscriptions/sse-handler.ts', 'utf8'),
  ]);

  assert.match(gatewayMiddleware, /createOrderWorkflowSubscriptionClient/);
  assert.match(gatewaySse, /orderWorkflow\.subscribe/);
  assert.equal(await exists('libs/wordpress/nest/src/subscriptions'), false);
});

// US-059 — Compose WordPress directly
test('AC-119: Reduced deployable topology @spec:AC-119', async () => {
  const [rootPackage, baseTsconfig, compose] = await Promise.all([
    readFile('package.json', 'utf8'),
    readFile('tsconfig.base.json', 'utf8'),
    readFile('compose.yaml', 'utf8'),
  ]);

  assert.equal(await exists('apps/wordpress-federation/project.json'), false);
  assert.equal(await exists('libs/wordpress/nest/project.json'), false);
  assert.doesNotMatch(rootPackage, /wordpress-nest/);
  assert.doesNotMatch(baseTsconfig, /wordpress-nest/);
  assert.doesNotMatch(
    compose,
    /@desafio-dev-backend-senior\/wordpress-federation/,
  );
});

// US-059 — Compose WordPress directly
test('AC-120: WordPress capabilities preserved @spec:AC-120', async () => {
  const [install, gateway, compose] = await Promise.all([
    readFile('apps/wordpress-integration/scripts/install-plugins.sh', 'utf8'),
    readFile('libs/gateway/nest/src/gateway.module.ts', 'utf8'),
    readFile('compose.yaml', 'utf8'),
  ]);

  assert.match(install, /wp-graphql-federations/);
  assert.match(gateway, /WORDPRESS_GRAPHQL_URL/);
  assert.match(compose, /WORDPRESS_GRAPHQL_URL: http:\/\/wordpress\/graphql/);
  assert.equal(await exists('libs/wordpress/nest/src/federation'), false);
});
