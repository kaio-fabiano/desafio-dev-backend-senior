import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'graphql';
import test from 'node:test';

test('AC-126: MCP exposes only least-privilege operations @spec:AC-126', async () => {
  const [config, project, gatewayAuth] = await Promise.all([
    readFile('apps/apollo-mcp/mcp.yaml', 'utf8'),
    readFile('apps/apollo-mcp/project.json', 'utf8'),
    readFile('libs/gateway/nest/src/auth/gateway-auth.module.ts', 'utf8'),
  ]);
  assert.match(gatewayAuth, /OAuthResourceModule\.register/);
  assert.match(gatewayAuth, /GATEWAY_AUDIENCE/);
  for (const scope of ['cart:read', 'orders:read', 'cart:write']) {
    assert.match(config, new RegExp(scope.replace(':', '\\:')));
  }
  assert.match(project, /milestone-6-mcp-operations\.test\.mjs/);
  assert.match(project, /milestone-6-mcp-oauth\.test\.mjs/);
});

test('AC-267: Shared GraphQL contracts are declarative, owned, and parseable @spec:AC-267', async () => {
  const contracts = join('libs', 'contracts', 'graphql');
  const schemaFiles = (await readdir(contracts, { recursive: true }))
    .filter((file) => file.endsWith('schema.graphql'))
    .sort();

  for (const file of schemaFiles) {
    const source = await readFile(join(contracts, file), 'utf8');
    assert.match(
      source,
      /^# Owner: Shared integration-contract boundary$/m,
      `${file} must name its owner`,
    );
    assert.doesNotMatch(
      source,
      /\bclass\s+\w+/i,
      `${file} must stay declarative`,
    );
    assert.doesNotThrow(
      () => parse(source),
      `${file} must remain valid GraphQL`,
    );
  }
});
