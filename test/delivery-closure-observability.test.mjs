import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');

test('AC-115: optional telemetry crosses RabbitMQ and Payment Federation @spec:AC-115', () => {
  const compose = read('compose.yaml');
  const rabbit = read('apps/order-workflow-subgraph/src/messaging/rabbitmq.ts');
  const commerceRuntime = read(
    'apps/order-workflow-subgraph/src/messaging/order-workflow-messaging.runtime.ts',
  );
  const payment = read(
    'apps/payment-federation/src/main/java/dev/desafio/transaction/payment/adapter/messaging/PaymentRabbitListener.java',
  );
  const inventory = read(
    'apps/payment-federation/src/main/java/dev/desafio/transaction/inventory/adapter/messaging/InventoryRabbitListener.java',
  );
  const collector = read('infra/observability/otel-collector.yaml');
  const runbook = read('docs/runbooks/observability.md');

  assert.match(compose, /profiles: \['observability'\]/);
  assert.match(compose, /OTEL_SERVICE_NAME: gateway/);
  assert.match(compose, /OTEL_SERVICE_NAME: payment-federation/);
  assert.match(
    compose,
    /MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE: health,prometheus/,
  );
  assert.match(rabbit, /traceparent/);
  assert.match(commerceRuntime, /operationKey: event\.payload\.operationKey/);
  assert.match(payment, /traceparent/);
  assert.match(inventory, /traceparent/);
  assert.match(collector, /exporters:\n  otlp\/jaeger:/);
  assert.match(runbook, /Never put access tokens/);
});
