import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import test from 'node:test';

const execute = promisify(execFile);
const javaBaseline = execute(
  'corepack',
  ['pnpm', 'exec', 'nx', 'run', 'payment-federation:test', '--skip-nx-cache'],
  { maxBuffer: 16 * 1024 * 1024 },
);

test('Payment Federation Java quality targets are serialized @spec:AC-292', async () => {
  const project = JSON.parse(
    await readFile('apps/payment-federation/project.json', 'utf8'),
  );

  for (const target of ['build', 'test', 'lint']) {
    assert.equal(project.targets[target].parallelism, false, `${target} must not overlap`);
  }
});

async function report(className) {
  await javaBaseline;
  return readFile(
    `apps/payment-federation/build/test-results/test/TEST-${className}.xml`,
    'utf8',
  );
}

test('Java architecture boundaries are enforced by JUnit @spec:AC-280', async () => {
  const xml = await report('dev.desafio.transaction.architecture.ContextArchitectureTest');

  assert.match(xml, /failures="0"/);
  assert.match(xml, /skipped="0"/);
  assert.match(xml, /Context and layer imports point inward without a hidden orchestrator/);
});

test('Axon PostgreSQL restart, replay, token, and concurrency behavior passes JUnit @spec:AC-282', async () => {
  const xml = await report(
    'dev.desafio.transaction.infrastructure.axon.AxonPersistenceRestartTest',
  );

  assert.match(xml, /tests="2"/);
  assert.match(xml, /failures="0"/);
  assert.match(xml, /skipped="0"/);
  assert.match(xml, /Events, projection effects, and processor positions survive restart and replay/);
  assert.match(xml, /Concurrent Axon writes preserve one stream consistency boundary/);
});

test('The real PostgreSQL migration baseline passes the Java quality gate @spec:AC-292', async () => {
  const xml = await report(
    'dev.desafio.transaction.infrastructure.persistence.PostgresMigrationIntegrationTest',
  );

  assert.match(xml, /failures="0"/);
  assert.match(xml, /skipped="0"/);
  assert.match(xml, /Fresh PostgreSQL migrations expose every AMQP consumer at startup/);
});

test('V1 integration contracts expose only the approved boundary fields @spec:AC-280', async () => {
  const envelope = JSON.parse(
    await readFile(
      'libs/contracts/events/integration-event-envelope.schema.json',
      'utf8',
    ),
  );

  assert.deepEqual(envelope.required, [
    'eventId',
    'eventType',
    'version',
    'aggregateId',
    'transactionId',
    'correlationId',
    'causationId',
    'occurredAt',
    'payload',
  ]);
  assert.doesNotMatch(JSON.stringify(envelope), /providerToken|accessToken|cardToken/i);
});

test('Real RabbitMQ and PostgreSQL prove reliable AMQP delivery @spec:AC-293 @spec:AC-230', async () => {
  const xml = await report(
    'dev.desafio.transaction.infrastructure.messaging.RabbitMqBoundaryIntegrationTest',
  );

  assert.match(xml, /failures="0"/);
  assert.match(xml, /skipped="0"/);
  assert.match(xml, /Outbox recovery, duplicate delivery, retry, and DLQ preserve the V1 envelope/);
});

test('The AMQP boundary participates in the repository quality gate @spec:AC-292', async () => {
  const xml = await report(
    'dev.desafio.transaction.infrastructure.messaging.RabbitMqBoundaryIntegrationTest',
  );

  assert.match(xml, /tests="1"/);
  assert.match(xml, /failures="0"/);
  assert.match(xml, /skipped="0"/);
});

test('Replayable projections use distinct command, event, and query paths @spec:AC-281 @spec:AC-287', async () => {
  const xml = await report(
    'dev.desafio.transaction.projection.TransactionProjectionReplayTest',
  );

  assert.match(xml, /failures="0"/);
  assert.match(xml, /skipped="0"/);
  assert.match(xml, /Commands, Domain Events, replayable projections, and Axon queries stay distinct/);
});

test('The Java endpoint preserves federated Order Workflow GraphQL @spec:AC-288', async () => {
  const xml = await report(
    'dev.desafio.transaction.graphql.OrderWorkflowGraphQlCompatibilityTest',
  );

  assert.match(xml, /failures="0"/);
  assert.match(xml, /skipped="0"/);
  assert.match(xml, /The Java HTTP endpoint preserves the Order Workflow GraphQL contract/);
});

test('Projection and GraphQL evidence participate in the repository gate @spec:AC-292', async () => {
  const [projection, graphql] = await Promise.all([
    report('dev.desafio.transaction.projection.TransactionProjectionReplayTest'),
    report('dev.desafio.transaction.graphql.OrderWorkflowGraphQlCompatibilityTest'),
  ]);

  assert.match(projection, /Projection evidence runs on PostgreSQL with no skipped quality gate/);
  assert.match(graphql, /Order Workflow GraphQL preserves scopes, owner isolation, validation, and errors/);
  assert.doesNotMatch(projection + graphql, /skipped="[1-9]/);
});

test('Axon subscription queries isolate each transaction over GraphQL SSE @spec:AC-289 @spec:AC-231', async () => {
  const xml = await report(
    'dev.desafio.transaction.subscription.TransactionSubscriptionSseTest',
  );

  assert.match(xml, /tests="6"/);
  assert.match(xml, /failures="0"/);
  assert.match(xml, /skipped="0"/);
  assert.match(xml, /HTTP SSE isolates simultaneous owners and transactions, orders versions, and reconnects/);
  assert.match(xml, /Subscription query suppresses stale versions and propagates cancellation/);
  assert.match(xml, /QueryUpdateEmitter filters by transaction and authenticated owner/);
  assert.match(xml, /Legacy orderEvents remains live through the Java SSE cutover/);
});

test('Gateway cutover preserves the public SSE edge and repository gate @spec:AC-288 @spec:AC-292', async () => {
  const gateway = await readFile('apps/gateway/src/app.module.ts', 'utf8');

  assert.match(gateway, /path: 'graphql\/stream'/);
  assert.match(gateway, /http:\/\/payment-federation:8080\/graphql/);
  assert.doesNotMatch(gateway, /http:\/\/order-workflow-subgraph:3003\/graphql\/stream/);
});

test('The complete RabbitMQ choreography and compensations pass Java E2E @spec:AC-283 @spec:AC-284 @spec:AC-286 @spec:AC-287 @spec:AC-293', async () => {
  const xml = await report(
    'dev.desafio.transaction.e2e.ChoreographedLifecycleE2ETest',
  );

  assert.match(xml, /tests="5"/);
  assert.match(xml, /failures="0"/);
  assert.match(xml, /skipped="0"/);
  assert.match(xml, /Inventory-first RabbitMQ lifecycle completes a replayable Transaction projection/);
  assert.match(xml, /Commit rejection triggers one provider refund and converges without regression/);
  assert.match(xml, /Inventory and Payment rejection reactions remain independent over RabbitMQ/);
  assert.match(xml, /Out-of-order outcomes retry and converge without projection regression/);
});

test('Choreography E2E participates in the repository quality gate @spec:AC-292', async () => {
  const xml = await report(
    'dev.desafio.transaction.e2e.ChoreographedLifecycleE2ETest',
  );

  assert.match(xml, /The lifecycle quality proof uses real PostgreSQL and RabbitMQ without skips/);
  assert.doesNotMatch(xml, /skipped="[1-9]/);
});

test('Clean-start migration blocks legacy rows and remains restartable @spec:AC-290 @spec:AC-292', async () => {
  const xml = await report(
    'dev.desafio.transaction.migration.LegacyCleanStartGateIntegrationTest',
  );

  assert.match(xml, /tests="2"/);
  assert.match(xml, /failures="0"/);
  assert.match(xml, /skipped="0"/);
  assert.match(xml, /Empty legacy state is restartable, side-effect-free, and append-only/);
  assert.match(xml, /Any current or historical legacy row blocks Java ownership/);
});

test('Cutover keeps Java as the sole compatible GraphQL, SSE, and AMQP owner @spec:AC-285 @spec:AC-287 @spec:AC-288 @spec:AC-289 @spec:AC-291 @spec:AC-293 @spec:AC-229 @spec:AC-243 @spec:AC-316', async () => {
  const [compose, environment, gateway, checkout, woo, projection, graphql, subscription, amqp] =
    await Promise.all([
      readFile('compose.yaml', 'utf8'),
      readFile('apps/e2e/src/environment.ts', 'utf8'),
      readFile('apps/gateway/src/app.module.ts', 'utf8'),
      report('dev.desafio.transaction.transaction.checkout.CheckoutServiceTest'),
      report('dev.desafio.transaction.transaction.adapter.woocommerce.WooCommerceGraphQlOrderAdapterTest'),
      report('dev.desafio.transaction.projection.TransactionProjectionReplayTest'),
      report('dev.desafio.transaction.graphql.OrderWorkflowGraphQlCompatibilityTest'),
      report('dev.desafio.transaction.subscription.TransactionSubscriptionSseTest'),
      report('dev.desafio.transaction.infrastructure.messaging.RabbitMqBoundaryIntegrationTest'),
    ]);

  assert.match(compose, /^  order-workflow-database:/m);
  assert.doesNotMatch(compose, /^  order-workflow-subgraph:/m);
  assert.match(compose, /ORDER_WORKFLOW_GRAPHQL_URL:.*payment-federation:8080\/graphql/);
  assert.match(compose, /ORDER_WORKFLOW_SUBSCRIPTION_URL:.*payment-federation:8080\/graphql/);
  assert.match(compose, /MIGRATION_LEGACY_CLEAN_START_ENABLED:.*true/);
  assert.match(compose, /PAYMENT_LEGACY_MESSAGING_ENABLED:.*false/);
  assert.match(compose, /INVENTORY_LEGACY_LISTENER_ENABLED:.*false/);
  assert.doesNotMatch(environment, /^\s*'order-workflow-subgraph',$/m);
  assert.match(gateway, /http:\/\/payment-federation:8080\/graphql/);
  for (const xml of [checkout, woo, projection, graphql, subscription, amqp]) {
    assert.match(xml, /failures="0"/);
    assert.match(xml, /skipped="0"/);
  }
});
