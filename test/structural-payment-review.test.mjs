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

test('AC-320: retired legacy messaging paths are absent @spec:AC-320', async () => {
  const files = await Promise.all([
    'apps/payment-federation/src/main/java/dev/desafio/transaction/payment/configuration/PaymentMessagingConfiguration.java',
    'apps/payment-federation/src/main/java/dev/desafio/transaction/payment/adapter/messaging/PaymentRabbitListener.java',
    'apps/payment-federation/src/main/java/dev/desafio/transaction/payment/adapter/messaging/PaymentConsumer.java',
  ].map(async (path) => {
    try { return await readFile(path, 'utf8'); } catch (error) {
      assert.equal(error.code, 'ENOENT');
      return '';
    }
  }));
  assert.deepEqual(files, ['', '', '']);
});

test('AC-322: active Axon messaging remains registered @spec:AC-322', async () => {
  const [payment, inventory] = await Promise.all([
    readFile('apps/payment-federation/src/main/java/dev/desafio/transaction/payment/configuration/AxonPaymentMessagingConfiguration.java', 'utf8'),
    readFile('apps/payment-federation/src/main/java/dev/desafio/transaction/inventory/adapter/messaging/AxonInventoryRabbitListener.java', 'utf8'),
  ]);
  assert.match(payment, /AxonPaymentRabbitListener/);
  assert.match(inventory, /queues = "inventory\.events\.v1"/);
  assert.doesNotMatch(inventory, /receiveLegacy|legacy-listener-enabled/);
});
