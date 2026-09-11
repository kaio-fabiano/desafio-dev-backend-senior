import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const testRoot = 'apps/payment-federation/src/test/java';

async function javaSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(entries.map(async (entry) => {
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) return javaSources(path);
      if (!entry.name.endsWith('.java')) return [];
      return [{ path, source: await readFile(path, 'utf8') }];
    }))
  ).flat();
}

async function source(path) {
  return readFile(path, 'utf8');
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

test('AC-317: framework metadata allowance stays narrow @spec:AC-317', async () => {
  const domain = await source('apps/payment-federation/src/main/java/dev/desafio/transaction/payment/domain/Payment.java');
  const application = await source('apps/payment-federation/src/main/java/dev/desafio/transaction/payment/application/axon/PaymentAggregate.java');
  assert.doesNotMatch(domain, /org\.springframework|org\.graphql|jakarta\.persistence|org\.rabbitmq|mercadopago/i);
  assert.match(application, /org\.axonframework/);
});

test('AC-318: GraphQL and checkout classes have explicit owners @spec:AC-318', async () => {
  const checkout = await readdir('apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/checkout');
  assert.ok(checkout.length > 0);
  assert.ok(checkout.every((name) => name.endsWith('.java')));
  assert.equal(await exists('apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/checkout/CheckoutService.java'), true);
  assert.equal(await exists('apps/payment-federation/src/main/java/dev/desafio/transaction/edge/CheckoutGraphQlController.java'), true);
});

test('AC-319: Spring composition has one named application Clock and direct federation configuration @spec:AC-319', async () => {
  const java = (await javaSources('apps/payment-federation/src/main/java')).map(({ source }) => source).join('\n');
  assert.equal((java.match(/Clock\s+(?:\w*Clock)\s*\(/g) ?? []).length, 1);
  assert.doesNotMatch(java, /implements\s+BeanPostProcessor|extends\s+BeanPostProcessor/);
  assert.equal(await exists('apps/payment-federation/src/main/java/dev/desafio/transaction/edge/configuration/FederationGraphqlConfiguration.java'), true);
});

test('AC-320: retired Payment and Inventory execution paths are absent @spec:AC-320', async () => {
  const forbidden = [
    'apps/payment-federation/src/main/java/dev/desafio/transaction/payment/adapter/messaging/PaymentRabbitListener.java',
    'apps/payment-federation/src/main/java/dev/desafio/transaction/payment/adapter/messaging/PaymentConsumer.java',
    'apps/payment-federation/src/main/java/dev/desafio/transaction/payment/configuration/PaymentMessagingConfiguration.java',
  ];
  for (const path of forbidden) assert.equal(await exists(path), false, path);
  const files = await readdir('apps/payment-federation/src/main/resources');
  assert.ok(files.includes('application.yaml'));
  assert.doesNotMatch(await source('apps/payment-federation/src/main/resources/application.yaml'), /legacy-(messaging|listener|api)/);
});

test('AC-321: source paths match Java package declarations @spec:AC-321', async () => {
  const violations = [];
  for (const { path, source } of await javaSources(testRoot)) {
    const packageName = source.match(/^package\s+([\w.]+);/m)?.[1];
    const expected = `${testRoot}/${packageName.replaceAll('.', '/')}/${path.split('/').pop()}`;
    if (path !== expected) violations.push(`${path} -> ${expected}`);
  }
  assert.deepEqual(violations, []);
});

test('AC-322: relocated tests remain present and executable @spec:AC-322', async () => {
  const sources = await javaSources(testRoot);
  assert.ok(sources.length > 0);
  assert.ok(sources.every(({ source }) => source.includes('import org.junit.jupiter.api.Test')));
});
