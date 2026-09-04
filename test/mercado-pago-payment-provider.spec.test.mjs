import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';

const root =
  'apps/payment-federation/src/main/java/dev/desafio/transaction/payment';

const providerPath = `${root}/adapter/mercadopago/MercadoPagoPaymentProvider.java`;
const webhookPath = `${root}/adapter/mercadopago/MercadoPagoWebhookController.java`;
const notificationHandlerPath = `${root}/application/ProviderNotificationHandler.java`;
const notificationRepositoryPath = `${root}/adapter/persistence/JdbcProviderNotificationRepository.java`;
const notificationMigrationPath =
  'apps/payment-federation/src/main/resources/db/migration/V4__provider_notification_inbox.sql';
const propertiesPath = `${root}/configuration/MercadoPagoProperties.java`;
const configurationPath = `${root}/configuration/PaymentConfiguration.java`;

async function javaSources(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map(async (entry) => {
        const path = `${directory}/${entry.name}`;
        if (entry.isDirectory()) return javaSources(path);
        if (!entry.name.endsWith('.java')) return [];
        return [{ path, source: await readFile(path, 'utf8') }];
      }),
    )
  ).flat();
}

test('AC-160: provider creation reuses the workflow operation key @spec:AC-160', async () => {
  const [build, provider] = await Promise.all([
    readFile('apps/payment-federation/build.gradle.kts', 'utf8'),
    readFile(providerPath, 'utf8'),
  ]);

  assert.match(build, /com\.mercadopago:sdk-java:/);
  assert.match(provider, /Headers\.IDEMPOTENCY_KEY/);
  assert.match(provider, /command\.operationKey\(\)/);
  assert.match(
    provider,
    /client\.create\(request, requestOptions\(command\.operationKey\(\)\)\)/,
  );
  assert.doesNotMatch(provider, /randomUUID|new\s+Random/);
});

test('AC-161: Card requests contain only a provider token @spec:AC-161', async () => {
  const provider = await readFile(providerPath, 'utf8');

  assert.match(provider, /\.token\(command\.providerToken\(\)\)/);
  assert.doesNotMatch(
    provider,
    /\b(?:pan|cardNumber|card_number|securityCode|security_code|cvv|cvc)\b/i,
  );
});

test('AC-162: Pix result uses Mercado Pago reference and QR payload @spec:AC-162', async () => {
  const provider = await readFile(providerPath, 'utf8');

  assert.match(provider, /\.paymentMethodId\("pix"\)/);
  assert.match(provider, /payment\.getId\(\)\.toString\(\)/);
  assert.match(
    provider,
    /getPointOfInteraction\(\)\.getTransactionData\(\)\.getQrCode\(\)/,
  );
  assert.doesNotMatch(provider, /PIX-[A-Za-z0-9]|stableUuid/);
});

test('AC-165: ambiguous creation remains recoverable with the same key @spec:AC-165', async () => {
  const [provider, handler] = await Promise.all([
    readFile(providerPath, 'utf8'),
    readFile(notificationHandlerPath, 'utf8'),
  ]);

  assert.match(provider, /catch \(MPException \| MPApiException exception\)/);
  assert.match(
    provider,
    /catch \(MPException \| MPApiException exception\) \{\s*return recoverCreation\(command, exception\);/,
  );
  assert.match(
    provider,
    /throw new IllegalStateException\("Mercado Pago payment creation failed", creationFailure\)/,
  );
  assert.match(provider, /requestOptions\(command\.operationKey\(\)\)/);
  assert.match(handler, /provider\.findByProviderReference/);
  assert.doesNotMatch(provider, /for\s*\(|while\s*\(|\.retry\s*\(/);
});

test('AC-163: signed webhooks are rejected or deduplicated before transition @spec:AC-163', async () => {
  const [controller, repository, migration] = await Promise.all([
    readFile(webhookPath, 'utf8'),
    readFile(notificationRepositoryPath, 'utf8'),
    readFile(notificationMigrationPath, 'utf8'),
  ]);

  assert.match(controller, /WebhookSignatureValidator\.validate\(/);
  assert.match(controller, /MPInvalidWebhookSignatureException/);
  assert.match(controller, /HttpStatus\.UNAUTHORIZED/);
  assert.match(
    controller,
    /ResponseEntity<Void> receive\([\s\S]*?validateSignature\([\s\S]*?handler\.handle\(/,
  );
  assert.match(migration, /provider_request_id text primary key/);
  assert.match(repository, /on conflict \(provider_request_id\) do nothing/);
});

test('AC-164: notification fetches and correlates authoritative state before a monotonic transition @spec:AC-164', async () => {
  const [handler, repository] = await Promise.all([
    readFile(notificationHandlerPath, 'utf8'),
    readFile(notificationRepositoryPath, 'utf8'),
  ]);

  assert.match(
    handler,
    /provider\.findByProviderReference\(notification\.providerReference\(\)\)/,
  );
  assert.ok(
    handler.indexOf('provider.findByProviderReference(') <
      handler.indexOf('repository.apply('),
    'authoritative lookup must happen before persistence',
  );
  assert.match(repository, /where provider_reference = \?\s+for update/);
  assert.match(repository, /isMonotonicTransition/);
  assert.match(repository, /insertOutbox/);
  assert.match(repository, /connection\.commit\(\)/);
});

test('AC-166: refund confirmation uses the persisted original provider reference @spec:AC-166', async () => {
  const [provider, handler, repository] = await Promise.all([
    readFile(providerPath, 'utf8'),
    readFile(notificationHandlerPath, 'utf8'),
    readFile(notificationRepositoryPath, 'utf8'),
  ]);

  assert.match(provider, /providerId\(command\.providerReference\(\)\)/);
  assert.match(
    provider,
    /client\.refund\(providerId, requestOptions\(command\.operationKey\(\)\)\)/,
  );
  assert.match(handler, /notification\.providerReference\(\)/);
  assert.match(repository, /where provider_reference = \?/);
  assert.match(
    repository,
    /"AUTHORIZED"\.equals\(currentStatus\)[\s\S]*"REFUNDED"\.equals\(targetStatus\)/,
  );
  assert.match(repository, /payment\.refunded/);
});

test('AC-167: Mercado Pago mode validates secrets, endpoint and timeouts at startup @spec:AC-167', async () => {
  const [properties, configuration, yaml] = await Promise.all([
    readFile(propertiesPath, 'utf8'),
    readFile(configurationPath, 'utf8'),
    readFile(
      'apps/payment-federation/src/main/resources/application.yaml',
      'utf8',
    ),
  ]);

  assert.match(properties, /@ConfigurationProperties\("payment\.provider"\)/);
  for (const required of [
    'accessToken',
    'webhookSecret',
    'apiBaseUrl',
    'connectionTimeout',
    'readTimeout',
  ]) {
    assert.match(
      properties,
      new RegExp(`require(?:Text|Positive|OfficialEndpoint)\\(${required}`),
    );
  }
  assert.match(configuration, /havingValue = "mercado-pago"/);
  assert.match(configuration, /@Profile\(\{"local", "test"\}\)/);
  assert.match(yaml, /PAYMENT_PROVIDER_MODE/);
  assert.match(yaml, /MERCADO_PAGO_ACCESS_TOKEN/);
  assert.match(yaml, /MERCADO_PAGO_WEBHOOK_SECRET/);
  assert.match(yaml, /MERCADO_PAGO_API_BASE_URL/);
});

test('AC-168: provider behavior has repeatable credential-free and sandbox evidence @spec:AC-168', async () => {
  const testPaths = [
    'apps/payment-federation/src/test/java/dev/desafio/transaction/payment/adapter/mercadopago/MercadoPagoPaymentProviderTest.java',
    'apps/payment-federation/src/test/java/dev/desafio/transaction/payment/adapter/mercadopago/MercadoPagoWebhookControllerTest.java',
    'apps/payment-federation/src/test/java/dev/desafio/transaction/payment/application/ProviderNotificationHandlerTest.java',
    'apps/payment-federation/src/test/java/dev/desafio/transaction/payment/application/ArchitectureBoundariesTest.java',
  ];
  const [tests, runbook, adr] = await Promise.all([
    Promise.all(testPaths.map((path) => readFile(path, 'utf8'))),
    readFile('docs/runbooks/mercado-pago-sandbox.md', 'utf8'),
    readFile('docs/adrs/010-mercado-pago-payment-provider.md', 'utf8'),
  ]);
  const testSource = tests.join('\n');

  for (const criterion of [160, 161, 162, 163, 164, 165, 166, 169]) {
    assert.match(testSource, new RegExp(`@spec:AC-${criterion}`));
  }
  assert.doesNotMatch(testSource, /@Disabled|\.skip\(|\.todo\(/);
  assert.match(runbook, /Credential-free gate/);
  assert.match(runbook, /Sandbox verification/);
  assert.match(runbook, /original operation key/);
  assert.match(runbook, /invalid signature/);
  assert.match(runbook, /persisted\s+provider reference/);
  assert.match(adr, /transparent Payments API/);
});

test('AC-169: Java packages enforce inward dependencies for Payment and Inventory @spec:AC-169', async () => {
  const transactionRoot =
    'apps/payment-federation/src/main/java/dev/desafio/transaction';
  const sources = await javaSources(transactionRoot);
  const contexts = new Set();
  const violations = [];

  assert.ok(sources.length > 0, 'expected transaction bounded-context sources');
  for (const { path, source } of sources) {
    const relative = path.slice(transactionRoot.length + 1);
    const [context] = relative.split('/');
    if (context === 'payment' || context === 'inventory') {
      contexts.add(context);
    }
    if (
      relative !== 'PaymentFederationApplication.java' &&
      !/^(?:payment|inventory)\/(?:domain|application|adapter|configuration)\//.test(
        relative,
      )
    ) {
      violations.push(`${relative}: source is outside a named context/layer`);
    }
    if (
      relative.includes('/domain/') &&
      /import (?:org\.springframework|com\.mercadopago|com\.rabbitmq|java\.sql)/.test(
        source,
      )
    ) {
      violations.push(`${relative}: domain imports an outer technology`);
    }
    if (
      relative.includes('/application/') &&
      /import (?:org\.springframework|com\.mercadopago|dev\.desafio\.transaction\.(?:payment|inventory)\.adapter)/.test(
        source,
      )
    ) {
      violations.push(`${relative}: application imports an adapter`);
    }
    if (
      relative.startsWith('payment/') &&
      /import dev\.desafio\.transaction\.inventory\./.test(source)
    ) {
      violations.push(`${relative}: Payment imports Inventory`);
    }
    if (
      relative.startsWith('inventory/') &&
      /import dev\.desafio\.transaction\.payment\./.test(source)
    ) {
      violations.push(`${relative}: Inventory imports Payment`);
    }
  }

  assert.deepEqual([...contexts].sort(), ['inventory', 'payment']);
  assert.deepEqual(violations, []);
  assert.match(
    await readFile(providerPath, 'utf8'),
    /package dev\.desafio\.transaction\.payment\.adapter\.mercadopago;/,
  );
  assert.match(
    await readFile(propertiesPath, 'utf8'),
    /package dev\.desafio\.transaction\.payment\.configuration;/,
  );
});
