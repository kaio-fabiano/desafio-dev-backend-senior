import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const [compose, commerceModule, paymentDockerfile, stockDockerfile, stockModule] = await Promise.all([
  readFile('compose.yaml', 'utf8'),
  readFile('apps/commerce-subgraph/src/app.module.ts', 'utf8'),
  readFile('apps/payment-processor/Dockerfile', 'utf8'),
  readFile('apps/stock-worker/Dockerfile', 'utf8'),
  readFile('apps/stock-worker/src/app.module.ts', 'utf8'),
]);

test('AC-042: the superseded RabbitMQ topology is archived rather than deployed @spec:AC-042', () => {
  assert.doesNotMatch(compose, /^  rabbitmq:/m);
  assert.doesNotMatch(compose, /RABBITMQ_URL|amqp:\/\//);
  const activeServices = compose.split('\nx-retired-runtimes:')[0];
  assert.doesNotMatch(activeServices, /^  (?:commerce-subgraph|stock-worker):/m);
});

test('AC-045: Compose gives payment its own ready database and consumers close gracefully @spec:AC-045', () => {
  assert.match(compose, /payment-database:\n    image: postgres:17\.6-bookworm/);
  assert.match(compose, /POSTGRES_DB: payment/);
  assert.match(compose, /SPRING_DATASOURCE_URL: jdbc:postgresql:\/\/payment-database:5432\/payment/);
  assert.match(compose, /payment-database:\n        condition: service_healthy/);
  assert.match(compose, /stop_grace_period: 35s/);
  assert.match(commerceModule, /onApplicationShutdown[\s\S]*runtime\?\.close/);
  assert.match(stockModule, /async stop[\s\S]*consumerBroker\?\.close/);
  assert.match(stockModule, /async stop[\s\S]*publisherBroker\?\.close/);
  assert.match(stockModule, /async stop[\s\S]*database\?\.end/);
  assert.match(stockModule, /process\.once\('SIGTERM'/);
  assert.match(paymentDockerfile, /ENTRYPOINT \["java", "-jar", "\/app\/app\.jar"\]/);
  assert.match(stockDockerfile, /CMD \["node", "--experimental-transform-types", "apps\/stock-worker\/src\/app\.module\.ts"\]/);
});
