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
