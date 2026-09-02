import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function paymentSecurityBoundary() {
  return Promise.all([
    readFile(
      'apps/payment-federation/src/main/java/dev/desafio/transaction/payment/configuration/PaymentGraphqlConfiguration.java',
      'utf8',
    ),
    readFile(
      'apps/payment-federation/src/main/java/dev/desafio/transaction/payment/configuration/PaymentSecurityConfiguration.java',
      'utf8',
    ),
    readFile(
      'apps/payment-federation/src/main/java/dev/desafio/transaction/payment/adapter/graphql/PaymentController.java',
      'utf8',
    ),
  ]);
}

test('AC-124: Payment keeps reliable isolated adapters @spec:AC-124', async () => {
  const [configuration, security, controller] = await paymentSecurityBoundary();
  assert.match(security, /oauth2ResourceServer/);
  assert.doesNotMatch(
    `${configuration}\n${controller}`,
    /x-federation-secret|x-authenticated-subject|x-authenticated-scopes|MessageDigest/,
  );
});

test('AC-177: Payment delegates bearer validation to Spring Security @spec:AC-177', async () => {
  const [configuration, security, controller] = await paymentSecurityBoundary();
  assert.match(security, /requestMatchers\("\/graphql"\)\.authenticated\(\)/);
  assert.match(security, /oauth2ResourceServer/);
  assert.match(controller, /@PreAuthorize/);
  assert.doesNotMatch(configuration, /WebGraphQlInterceptor|federation\.internal-secret/);
});
