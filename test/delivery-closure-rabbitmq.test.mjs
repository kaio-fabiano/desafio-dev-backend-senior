import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import Ajv from 'ajv/dist/2020.js';

import { CheckoutService } from '../apps/commerce-subgraph/src/checkout/checkout.service.ts';
import { createWooOrderAdapter } from '../apps/commerce-subgraph/src/checkout/woo-order.adapter.ts';
import {
  COMMERCE_EVENT_ROUTING_KEYS,
  COMMERCE_QUEUE,
} from '../apps/commerce-subgraph/src/messaging/commerce-messaging.runtime.ts';
import {
  MARKETPLACE_EXCHANGE,
  declareConsumerQueue,
  declareRabbitMqTopology,
} from '../apps/commerce-subgraph/src/messaging/rabbitmq.ts';
import { OutboxPublisher } from '../apps/commerce-subgraph/src/outbox/outbox.publisher.ts';

test('AC-110: checkout persists a durable RabbitMQ choreography command @spec:AC-110', async () => {
  const operation = {
    id: '84a1efee-0629-42d5-9329-117c133ff1b0',
    operationKey: 'checkout-client-110',
  };
  const outboxRows = [];
  const checkout = new CheckoutService(
    {
      async claim(input) {
        return { created: true, operation: { ...operation, ...input } };
      },
      async confirm(operationId, wooOrderId, stockItems, onConfirmed) {
        const workflow = {
          id: '88f10f4f-4618-449c-91e2-f899812d68a9',
          checkoutOperationId: operationId,
          stockItems,
          wooOrderId,
        };
        await onConfirmed({}, workflow);
        return workflow;
      },
    },
    {
      async enqueueCheckoutRequested(_transaction, workflowId, event) {
        outboxRows.push({
          eventType: 'payment.requested',
          id: 'c85d8ca8-d5ce-46dc-b4a5-c5dbd9cbbeaf',
          occurredAt: new Date('2026-08-31T12:00:00.000Z'),
          payload: event,
          workflowId,
        });
      },
    },
    {
      async createOrFind() {
        return { id: '701' };
      },
    },
  );

  assert.deepEqual(
    await checkout.checkout({
      cartSnapshot: {
        items: [{ id: 42, quantity: 2 }],
        totals: {
          currency_code: 'BRL',
          currency_minor_unit: 2,
          total_price: '1990',
        },
      },
      operationKey: operation.operationKey,
      paymentMethod: 'CARD',
      subject: 'buyer-110',
    }),
    { operationId: operation.id, wooOrderId: '701' },
  );
  assert.deepEqual(outboxRows[0].payload, {
    amount: 19.9,
    checkoutId: operation.id,
    currency: 'BRL',
    method: 'CARD',
    operationKey: operation.operationKey,
    orderId: '701',
    paymentId: `payment-${operation.id}`,
  });

  let wooOrderCreations = 0;
  const wooOrders = createWooOrderAdapter({
    consumerKey: 'local-test-key',
    consumerSecret: 'local-test-secret',
    endpoint: 'http://wordpress',
    async request(_url, init) {
      if (init?.method === 'POST') {
        wooOrderCreations += 1;
        return new Response(JSON.stringify({ id: 702 }), { status: 201 });
      }
      return new Response(JSON.stringify([]), {
        headers: { 'x-wp-totalpages': '1' },
        status: 200,
      });
    },
  });
  const concurrentOrders = await Promise.all(
    Array.from({ length: 8 }, () =>
      wooOrders.createOrFind({ reference: 'checkout-client-110' }),
    ),
  );
  assert.equal(wooOrderCreations, 1);
  assert.deepEqual(
    new Set(concurrentOrders.map(({ id }) => id)),
    new Set(['702']),
  );

  const published = [];
  const sent = [];
  const outbox = new OutboxPublisher(
    {
      async transactional(callback) {
        return callback({});
      },
    },
    {
      async claimUnsent() {
        return outboxRows;
      },
      async markPublicationAttempt() {},
      async markSent(_transaction, eventId) {
        sent.push(eventId);
      },
    },
    {
      async publish(event) {
        published.push(event);
      },
    },
  );
  assert.equal(await outbox.publishBatch(), 1);
  assert.deepEqual(sent, [outboxRows[0].id]);
  assert.deepEqual(published[0], {
    eventId: outboxRows[0].id,
    eventType: 'payment.requested',
    eventVersion: 'v1',
    occurredAt: '2026-08-31T12:00:00.000Z',
    operationKey: operation.operationKey,
    payload: {
      amount: 19.9,
      checkoutId: operation.id,
      currency: 'BRL',
      method: 'CARD',
      orderId: '701',
      paymentId: `payment-${operation.id}`,
    },
    traceContext: { traceId: published[0].traceContext.traceId },
  });
  assert.match(published[0].traceContext.traceId, /^[0-9a-f]{32}$/);
  const [envelopeSchema, paymentRequestedSchema] = await Promise.all([
    readFile('libs/contracts/events/envelope.schema.json', 'utf8').then(
      JSON.parse,
    ),
    readFile(
      'libs/contracts/events/payment-requested.v1.schema.json',
      'utf8',
    ).then(JSON.parse),
  ]);
  const ajv = new Ajv({ validateFormats: false });
  ajv.addSchema(envelopeSchema);
  assert.equal(
    ajv.validate(paymentRequestedSchema, published[0]),
    true,
    JSON.stringify(ajv.errors),
  );

  const topology = { bindings: [], exchanges: [], queues: [] };
  const channel = {
    async assertExchange(name, type, options) {
      topology.exchanges.push({ name, options, type });
    },
    async assertQueue(name, options) {
      topology.queues.push({ name, options });
    },
    async bindQueue(queue, exchange, routingKey) {
      topology.bindings.push({ exchange, queue, routingKey });
    },
  };
  await declareRabbitMqTopology(channel);
  await declareConsumerQueue(
    channel,
    COMMERCE_QUEUE,
    COMMERCE_EVENT_ROUTING_KEYS,
  );
  assert.ok(
    topology.exchanges.every(({ options }) => options.durable === true),
  );
  assert.ok(topology.queues.every(({ options }) => options.durable === true));
  assert.ok(
    topology.bindings.some(
      ({ exchange, queue, routingKey }) =>
        exchange === MARKETPLACE_EXCHANGE &&
        queue === COMMERCE_QUEUE &&
        routingKey === 'payment.authorized',
    ),
  );
  assert.ok(
    topology.bindings.some(
      ({ exchange, queue, routingKey }) =>
        exchange === MARKETPLACE_EXCHANGE &&
        queue === COMMERCE_QUEUE &&
        routingKey === 'stock.reserved',
    ),
  );

  const [compose, runtime, commerceSchema] = await Promise.all([
    readFile('compose.yaml', 'utf8'),
    readFile(
      'apps/commerce-subgraph/src/messaging/commerce-messaging.runtime.ts',
      'utf8',
    ),
    readFile('libs/contracts/graphql/commerce/schema.graphql', 'utf8'),
  ]);
  assert.match(compose, /^  rabbitmq:/m);
  assert.match(compose, /^  commerce-database:/m);
  assert.match(compose, /^  commerce-subgraph:/m);
  assert.match(compose, /RABBITMQ_URL: amqp:\/\/rabbitmq:5672/);
  assert.match(runtime, /consumeWithRetry/);
  assert.doesNotMatch(runtime, /fetch\(|payment-processor|stock-worker/);
  assert.match(
    commerceSchema,
    /startCheckout\(input: CommerceCheckoutInput!\): Order!/,
  );
  assert.doesNotMatch(commerceSchema, /\n\s*checkout\(input: CheckoutInput!/);
});
