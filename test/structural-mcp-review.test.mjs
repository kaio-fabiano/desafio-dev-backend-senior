import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
