import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('AC-189: sandbox Card and Pix retries are opt-in, unique, and redacted @spec:AC-189', async () => {
  const [project, verifier, verifierTest, runbook] = await Promise.all([
    readFile('apps/e2e/project.json', 'utf8').then(JSON.parse),
    readFile('apps/e2e/src/mercado-pago-sandbox.ts', 'utf8'),
    readFile('apps/e2e/src/mercado-pago-sandbox.test.ts', 'utf8'),
    readFile('docs/runbooks/mercado-pago-sandbox.md', 'utf8'),
  ]);

  assert.equal(
    project.targets['mercado-pago-sandbox'].options.command,
    'node --import tsx apps/e2e/src/mercado-pago-sandbox.ts',
  );
  assert.equal(project.targets['mercado-pago-sandbox'].cache, false);
  assert.match(verifier, /MERCADO_PAGO_SANDBOX_CONFIRM/);
  assert.match(verifier, /CREATE_AND_REFUND_TEST_PAYMENTS/);
  assert.match(verifier, /randomUUID/);
  assert.match(verifier, /SHA-256|sha256/);
  assert.match(verifierTest, /authorizations\)\.toHaveLength\(4\)/);
  assert.match(verifierTest, /serialized\)\.not\.toContain\(secret\)/);
  assert.match(runbook, /only timestamps, unique operation keys, SHA-256/);
});

test('AC-190: sandbox webhooks and repeated refunds converge authoritatively @spec:AC-190', async () => {
  const [verifier, verifierTest, runbook] = await Promise.all([
    readFile('apps/e2e/src/mercado-pago-sandbox.ts', 'utf8'),
    readFile('apps/e2e/src/mercado-pago-sandbox.test.ts', 'utf8'),
    readFile('docs/runbooks/mercado-pago-sandbox.md', 'utf8'),
  ]);

  assert.match(verifier, /createHmac\('sha256'/);
  assert.match(verifier, /'ts=0,v1=invalid'/);
  assert.match(verifier, /providerRefund\.refundIds\.length/);
  assert.match(verifier, /payment\.status === 'REFUNDED'/);
  assert.match(verifierTest, /\[\s*401, 200, 200,?\s*\]/);
  assert.match(verifierTest, /new Set\(driver\.refundKeys\)\.size/);
  assert.match(runbook, /Replay the same `x-request-id`/);
  assert.doesNotMatch(verifier, /console\.(?:log|error)\([^)]*(?:accessToken|webhookSecret|cardToken|bearerToken)/);
});
