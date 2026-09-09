import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

test('Java is the sole deployed Transaction owner after Node retirement @spec:AC-291', async () => {
  const [compose, infrastructure, supergraph] = await Promise.all([
    readFile('compose.yaml', 'utf8'),
    readFile('infra/sst.config.ts', 'utf8'),
    readFile('libs/contracts/graphql/supergraph.yaml', 'utf8'),
  ]);

  await assert.rejects(access('apps/order-workflow-subgraph'), { code: 'ENOENT' });
  assert.doesNotMatch(compose, /^  order-workflow-subgraph:/m);
  assert.match(compose, /MIGRATION_LEGACY_CLEAN_START_ENABLED/);
  assert.doesNotMatch(infrastructure, /OrderWorkflow(?:Subgraph|Database)/);
  assert.match(
    infrastructure,
    /ORDER_WORKFLOW_GRAPHQL_URL:.*PaymentFederation.*\/graphql/,
  );
  assert.match(
    infrastructure,
    /ORDER_WORKFLOW_SUBSCRIPTION_URL:.*PaymentFederation.*\/graphql/,
  );
  assert.match(
    supergraph,
    /order-workflow:\n\s+routing_url: http:\/\/payment-federation:8080\/graphql/,
  );
});

test('Final repository and operations evidence covers every T-253 quality gate @spec:AC-280 @spec:AC-282 @spec:AC-286 @spec:AC-288 @spec:AC-289 @spec:AC-290 @spec:AC-291 @spec:AC-292 @spec:AC-293', async () => {
  const runbook = await readFile(
    'docs/runbooks/java-axon-order-workflow-operations.md',
    'utf8',
  );

  for (const requiredSection of [
    'Replay and projection rebuild',
    'Outbox recovery',
    'DLQ replay',
    'Migrations',
    'Backup and restore',
    'Observability',
    'Incident ownership',
    'Forward recovery',
  ]) {
    assert.match(runbook, new RegExp(`^## ${requiredSection}$`, 'm'));
  }
  assert.doesNotMatch(runbook, /NOT VERIFIED/);
});

test('Java checkout uses the remaining WordPress service identity @spec:AC-288 @spec:AC-291', async () => {
  const [configuration, entrypoint, installer] = await Promise.all([
    readFile(
      'apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/configuration/TransactionConfiguration.java',
      'utf8',
    ),
    readFile('apps/wordpress-integration/scripts/production-entrypoint.sh', 'utf8'),
    readFile('apps/wordpress-integration/scripts/install-plugins.sh', 'utf8'),
  ]);

  assert.match(
    configuration,
    /transaction\.checkout\.service-identity:payment-federation/,
  );
  assert.doesNotMatch(entrypoint + installer, /user (?:get|create) order-workflow/);
});
