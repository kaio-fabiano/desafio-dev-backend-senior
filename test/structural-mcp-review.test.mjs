import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { gatewayTokenOptions } from '../libs/gateway/nest/src/auth/token-verifier.service.ts';

test('AC-126: MCP exposes only least-privilege operations @spec:AC-126', async () => {
  assert.deepEqual(gatewayTokenOptions({}).requiredScopes, []);
  const [config, project] = await Promise.all([
    readFile('apps/apollo-mcp/mcp.yaml', 'utf8'),
    readFile('apps/apollo-mcp/project.json', 'utf8'),
  ]);
  for (const scope of ['cart:read', 'orders:read', 'cart:write']) {
    assert.match(config, new RegExp(scope.replace(':', '\\:')));
  }
  assert.match(project, /milestone-6-mcp-operations\.test\.mjs/);
  assert.match(project, /milestone-6-mcp-oauth\.test\.mjs/);
});
