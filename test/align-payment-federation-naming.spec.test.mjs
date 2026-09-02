// Testes de spec da feature align-payment-federation-naming — gerados por onp-spec scaffold
import { LocalCompose } from '@apollo/gateway';
import { parse } from 'graphql';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { test } from 'node:test';

const exists = (path) =>
  access(path).then(
    () => true,
    () => false,
  );

// US-074 — Make runtime naming match its bounded context
test('AC-152: Payment Federation has one canonical name @spec:AC-152', async () => {
  // Dado: the application, Nx graph, Compose topology, and deployment configuration
  // Quando: their active runtime names and paths are inspected
  // Então: they consistently use `payment-federation` without active `payment-processor` paths
  const [project, compose, gateway, deployment, continuousIntegration] =
    await Promise.all([
      readFile('apps/payment-federation/project.json', 'utf8').then(JSON.parse),
      readFile('compose.yaml', 'utf8'),
      readFile('libs/gateway/nest/src/gateway.module.ts', 'utf8'),
      readFile('infra/sst.config.ts', 'utf8'),
      readFile('.github/workflows/ci.yml', 'utf8'),
    ]);

  assert.equal(project.name, '@desafio-dev-backend-senior/payment-federation');
  assert.equal(project.sourceRoot, 'apps/payment-federation/src/main');
  assert.match(compose, /^ {2}payment-federation:/m);
  assert.match(gateway, /http:\/\/payment-federation:8080\/graphql/);
  assert.match(deployment, /apps\/payment-federation\/Dockerfile/);
  assert.match(continuousIntegration, /apps\/payment-federation\/Dockerfile/);
  assert.equal(await exists('apps/payment-processor'), false);
});

// US-074 — Make runtime naming match its bounded context
test('AC-153: Payment and Inventory remain internal participants @spec:AC-153', async () => {
  // Dado: the renamed Java runtime
  // Quando: its package and messaging structure is inspected
  // Então: Payment and Inventory remain isolated modules and RabbitMQ participants in the same deployment
  const [configuration, paymentListener, inventoryListener] = await Promise.all(
    [
      readFile(
        'apps/payment-federation/src/main/java/dev/desafio/payment/configuration/PaymentConfiguration.java',
        'utf8',
      ),
      readFile(
        'apps/payment-federation/src/main/java/dev/desafio/payment/adapter/messaging/PaymentRabbitListener.java',
        'utf8',
      ),
      readFile(
        'apps/payment-federation/src/main/java/dev/desafio/payment/adapter/messaging/InventoryRabbitListener.java',
        'utf8',
      ),
    ],
  );

  assert.match(configuration, /PaymentHandler/);
  assert.match(configuration, /InventoryService/);
  assert.match(paymentListener, /@RabbitListener/);
  assert.match(inventoryListener, /@RabbitListener/);
});

// US-074 — Make runtime naming match its bounded context
test('AC-157: Payment queue uses the canonical federation name @spec:AC-157', async () => {
  const configuration = await readFile(
    'apps/payment-federation/src/main/java/dev/desafio/payment/adapter/messaging/PaymentRuntimeConfiguration.java',
    'utf8',
  );

  assert.match(configuration, /PAYMENT_QUEUE = "payment-federation\.v1"/);
  assert.doesNotMatch(configuration, /payment-processor\.v1/);
  assert.match(configuration, /EVENTS = "marketplace\.events\.v1"/);
  assert.match(configuration, /with\("payment\.requested"\)/);
});

// US-075 — Remove the retired Catalog contract
test('AC-154: Catalog contract is absent @spec:AC-154', async () => {
  // Dado: the GraphQL contract directory and supergraph configuration
  // Quando: active subgraphs are enumerated
  // Então: the orphan Catalog contract is absent and the four supported subgraphs still compose
  assert.equal(await exists('libs/contracts/graphql/catalog'), false);
  const names = ['identity', 'wordpress', 'payment', 'order-workflow'];
  const localServiceList = await Promise.all(
    names.map(async (name) => ({
      name,
      url: `http://${name}/graphql`,
      typeDefs: parse(
        await readFile(`libs/contracts/graphql/${name}/schema.graphql`, 'utf8'),
      ),
    })),
  );
  const manager = new LocalCompose({ localServiceList });
  const result = await manager.initialize({ getDataSource: () => ({}) });

  assert.match(result.supergraphSdl, /order-workflow/);
  assert.doesNotMatch(result.supergraphSdl, /catalog/);
});

// US-076 — Make the WordPress bootstrap reproducible
test('AC-155: Plugin bootstrap is idempotent and production stays immutable @spec:AC-155', async () => {
  const [installer, architectureDecision] = await Promise.all([
    readFile(
      'apps/wordpress-integration/scripts/install-plugins.sh',
      'utf8',
    ),
    readFile('docs/adrs/003-wordpress-federation.md', 'utf8'),
  ]);

  assert.match(installer, /ensure_plugin\(\)/);
  assert.match(installer, /wp plugin get "\$slug" --field=version/);
  assert.match(installer, /"\$installed_version" == "\$version"/);
  assert.ok(
    installer.indexOf('return') < installer.indexOf('wp plugin install'),
  );
  assert.match(installer, /wp plugin install "\$source" --activate --force/);
  assert.match(architectureDecision, /immutable WordPress image/i);
  assert.match(architectureDecision, /must not download plugins at startup/i);
});

// US-077 — Keep Order Workflow deployable across database states
test('AC-158: Rename migration handles fresh and legacy schemas @spec:AC-158', async () => {
  const migration = await readFile(
    'apps/order-workflow-subgraph/src/persistence/migrations/Migration202609010003.ts',
    'utf8',
  );

  assert.match(migration, /to_regclass\('\$\{source\}'\) is not null/);
  assert.match(migration, /to_regclass\('\$\{target\}'\) is null/);
  assert.match(migration, /alter table "\$\{source\}" rename to "\$\{target\}"/);
  assert.match(migration, /renameTables\('commerce', 'order_workflow'\)/);
  assert.match(migration, /renameTables\('order_workflow', 'commerce'\)/);
});
