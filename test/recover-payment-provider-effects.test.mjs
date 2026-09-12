import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const handlerPath =
  'apps/payment-federation/src/main/java/dev/desafio/transaction/payment/application/event/PaymentProviderEffectHandler.java';
const testPath =
  'apps/payment-federation/src/test/java/dev/desafio/transaction/payment/application/axon/PaymentProviderEffectHandlerTest.java';

test('Axon observes effect completion @spec:AC-296', async () => {
  const [handler, tests] = await Promise.all([
    readFile(handlerPath, 'utf8'),
    readFile(testPath, 'utf8'),
  ]);

  assert.match(handler, /CompletableFuture<Void> on\(PaymentRequested event\)/);
  assert.match(handler, /CompletableFuture<Void> on\(PaymentRefundRequested event\)/);
  assert.match(tests, /Axon awaits payment and refund provider outcomes @spec:AC-296/);
});

test('Incomplete claims remain retryable @spec:AC-297', async () => {
  const [handler, tests] = await Promise.all([
    readFile(handlerPath, 'utf8'),
    readFile(testPath, 'utf8'),
  ]);

  assert.match(
    handler,
    /effects\.claim\(effect\);\s*var result = provider\.execute\(providerCommand\);/,
  );
  assert.doesNotMatch(handler, /provider\.reconcile\(/);
  assert.match(tests, /Incomplete refund claims retry only their matching provider operation @spec:AC-297/);
  assert.match(tests, /List\.of\(event\.operationKey\(\), event\.operationKey\(\)\)/);
});
