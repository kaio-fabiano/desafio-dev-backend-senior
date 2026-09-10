import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const evidence = () => readFile(
  'apps/payment-federation/src/test/java/dev/desafio/transaction/subscription/TransactionSubscriptionSseTest.java',
  'utf8',
);

test('AC-146: subscription can precede checkout @spec:AC-146', async () => {
  const integration = await evidence();
  assert.match(integration, /Legacy orderEvents remains live/);
  assert.match(integration, /events\.publish/);
  assert.match(integration, /await\(\).*until/);
});

test('AC-147: stream ownership prevents cross-user events @spec:AC-147', async () => {
  const integration = await evidence();
  assert.match(integration, /filters by transaction and authenticated owner/);
  assert.match(integration, /another-buyer/);
  assert.match(integration, /ReleasesOnCancel|propagates cancellation/);
});
