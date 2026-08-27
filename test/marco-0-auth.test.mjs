import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  GATEWAY_AUDIENCE,
  MCP_AUDIENCE,
  REQUIRED_SCOPE,
} from './fixtures/auth-server.ts';
import { runMultiResourceProbe } from './fixtures/auth-probe.ts';

let proof;

test('AC-011: The same grant serves the gateway and MCP @spec:AC-011', async () => {
  proof ??= await runMultiResourceProbe();

  assert.deepEqual(proof.expectedAudiences, [GATEWAY_AUDIENCE, MCP_AUDIENCE]);
  for (const accepted of [proof.accepted.gateway, proof.accepted.mcp]) {
    assert.equal(accepted.issuer, proof.issuer);
    assert.deepEqual(accepted.audience, [GATEWAY_AUDIENCE, MCP_AUDIENCE]);
    assert.ok(accepted.scope.split(' ').includes(REQUIRED_SCOPE));
    assert.ok(accepted.expiresAt > accepted.issuedAt);
  }
});

test('AC-012: Missing audience is rejected @spec:AC-012', async () => {
  proof ??= await runMultiResourceProbe();

  assert.deepEqual(proof.rejected, [
    { accepted: false, resource: 'mcp' },
    { accepted: false, resource: 'gateway' },
  ]);
});
