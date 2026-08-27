import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const execute = promisify(execFile);
const probe = execute(process.execPath, ['apps/poc-sse/src/probe.ts'], {
  cwd: process.cwd(),
  timeout: 10_000,
}).then(({ stdout }) => JSON.parse(stdout.trim().split('\n').at(-1)));

test('AC-009: Event crosses gateway and subgraph through SSE @spec:AC-009', async () => {
  const result = await probe;

  assert.equal(result.federation, 'v2');
  assert.match(result.edgeContentType, /^text\/event-stream/);
  assert.match(result.subgraphContentType, /^text\/event-stream/);
  assert.deepEqual(result.event, {
    data: { orderStatusChanged: { orderId: 'order-42', status: 'PAID' } },
  });
});

test('AC-010: Compatibility failure produces a reproducible decision @spec:AC-010', async () => {
  const [result, decision] = await Promise.all([
    probe,
    readFile('docs/adrs/001-graphql-sse-federado.md', 'utf8'),
  ]);

  assert.equal(result.directGatewaySubscriptionTransport, false);
  assert.equal(result.decision, 'hybrid-graphql-sse-edge');
  for (const evidence of [
    '@apollo/gateway` 2.14.4',
    'graphql-sse` 2.6.1',
    'pnpm nx run @desafio-dev-backend-senior/poc-sse:probe',
    'hybrid-graphql-sse-edge',
    'text/event-stream',
  ]) {
    assert.ok(
      decision.includes(evidence),
      `ADR is missing evidence: ${evidence}`,
    );
  }
});
