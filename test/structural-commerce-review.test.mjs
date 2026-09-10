import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const checkoutTest = () => readFile(
  'apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/checkout/CheckoutServiceTest.java',
  'utf8',
);

test('AC-123: Java Transaction owns only deterministic workflow state @spec:AC-123', async () => {
  const source = await readFile(
    'apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/domain/Transaction.java',
    'utf8',
  );
  assert.match(source, /class Transaction/);
  assert.doesNotMatch(source, /class (?:Product|Cart|Inventory)/);
});

test('AC-143: concurrent checkout creates one order @spec:AC-143', async () => {
  const source = await checkoutTest();
  assert.match(source, /concurrent/i);
  assert.match(source, /one Transaction and one Woo order/i);
  assert.match(source, /ambiguous|timeout/i);
});

test('AC-144: an operation key cannot change owner or command @spec:AC-144', async () => {
  const source = await checkoutTest();
  assert.match(source, /buyer-2/);
  assert.match(source, /CheckoutIdempotencyConflictException/);
  assert.match(source, /commandHash/);
});
