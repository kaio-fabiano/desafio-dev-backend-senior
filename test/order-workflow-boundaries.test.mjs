import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

test('AC-141: Order Workflow is a logical contract owned by the Java deployment @spec:AC-141', async () => {
  const [supergraph, compose] = await Promise.all([
    readFile('libs/contracts/graphql/supergraph.yaml', 'utf8'),
    readFile('compose.yaml', 'utf8'),
  ]);
  await assert.rejects(access('apps/order-workflow-subgraph'), { code: 'ENOENT' });
  assert.match(supergraph, /order-workflow:\n\s+routing_url: http:\/\/payment-federation:8080\/graphql/);
  assert.doesNotMatch(compose, /^  order-workflow-subgraph:/m);
  assert.match(compose, /^  payment-federation:/m);
});

test('AC-142: Java Transaction persists process state, not commerce aggregates @spec:AC-142', async () => {
  const [migration, transaction] = await Promise.all([
    readFile('apps/payment-federation/src/main/resources/db/migration/transaction/R__transaction_checkout.sql', 'utf8'),
    readFile('apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/domain/Transaction.java', 'utf8'),
  ]);
  for (const state of [/operation_key/, /woo_order_id/, /status/]) assert.match(migration, state);
  assert.match(transaction, /class Transaction/);
  assert.doesNotMatch(`${migration}\n${transaction}`, /class\s+(?:Product|Cart|Customer|Order)\b/);
});
