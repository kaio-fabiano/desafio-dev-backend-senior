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
  assert.match(xml, /Fresh PostgreSQL migrations and the application baseline pass real quality gates/);
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

test('Real RabbitMQ and PostgreSQL prove reliable AMQP delivery @spec:AC-293', async () => {
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

test('Axon subscription queries isolate each transaction over GraphQL SSE @spec:AC-289', async () => {
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
