import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('AC-124: Payment keeps reliable isolated adapters @spec:AC-124', async () => {
  const [configuration, compose] = await Promise.all([
    readFile(
      'apps/payment-federation/src/main/java/dev/desafio/payment/configuration/PaymentConfiguration.java',
      'utf8',
    ),
    readFile('compose.yaml', 'utf8'),
  ]);
  assert.match(configuration, /x-federation-secret/);
  assert.match(configuration, /MessageDigest\.isEqual/);
  assert.match(configuration, /Untrusted federation request/);
  assert.match(
    compose,
    /payment-federation:[\s\S]*?FEDERATION_INTERNAL_SECRET: \$\{FEDERATION_INTERNAL_SECRET:-federation-local-only\}/,
  );
});
