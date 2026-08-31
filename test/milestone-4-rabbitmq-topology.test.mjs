import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  MARKETPLACE_DEAD_LETTER_EXCHANGE,
  MARKETPLACE_DEAD_LETTER_QUEUE,
  MARKETPLACE_EXCHANGE,
  MARKETPLACE_RETRY_EXCHANGE,
  RETRY_DELAYS_MS,
  consumeWithRetry,
  declareConsumerQueue,
  declareRabbitMqTopology,
  handleDelivery,
  publishConfirmed,
} from '../apps/commerce-subgraph/src/messaging/rabbitmq.ts';

function channelHarness() {
  const acknowledgements = [];
  const bindings = [];
  const exchanges = [];
  const publications = [];
  const queues = [];
  const returned = new Set();
  let consumer;
  const channel = {
    ack(message) {
      acknowledgements.push(message);
    },
    async assertExchange(name, type, options) {
      exchanges.push({ name, options, type });
    },
    async assertQueue(name, options) {
      queues.push({ name, options });
    },
    async bindQueue(queue, exchange, routingKey) {
      bindings.push({ exchange, queue, routingKey });
    },
    async consume(queue, handler, options) {
      consumer = { handler, options, queue };
    },
    nack() {},
    on(event, listener) {
      if (event === 'return') returned.add(listener);
      return this;
    },
    async prefetch() {},
    publish(exchange, routingKey, content, options, callback) {
      publications.push({ content, exchange, options, routingKey });
      callback();
      return true;
    },
    removeListener(event, listener) {
      if (event === 'return') returned.delete(listener);
      return this;
    },
  };
  return {
    acknowledgements,
    bindings,
    channel,
    consumer: () => consumer,
    exchanges,
    publications,
    queues,
    returned,
  };
}

const message = (attempt = 0) => ({
  content: Buffer.from(
    JSON.stringify({
      correlationId: 'operation-1',
      eventId: 'event-1',
      password: 'must-not-reach-the-dlq',
      payload: { buyerEmail: 'buyer@example.com' },
    }),
  ),
  fields: { routingKey: 'payment.requested.v1' },
  properties: {
    correlationId: 'operation-1',
    headers: { 'x-retry-attempt': attempt },
    messageId: 'event-1',
    type: 'payment.requested.v1',
  },
});

test('AC-042: retry and dead-letter topology is durable, native, and finite @spec:AC-042', async () => {
  const { bindings, channel, exchanges, queues } = channelHarness();
  await declareRabbitMqTopology(channel);
  await declareConsumerQueue(channel, 'payment.requests', [
    'payment.requested.v1',
  ]);

  assert.deepEqual(exchanges, [
    { name: MARKETPLACE_EXCHANGE, options: { durable: true }, type: 'topic' },
    {
      name: MARKETPLACE_RETRY_EXCHANGE,
      options: { durable: true },
      type: 'direct',
    },
    {
      name: MARKETPLACE_DEAD_LETTER_EXCHANGE,
      options: { durable: true },
      type: 'topic',
    },
  ]);
  assert.equal(queues.length, RETRY_DELAYS_MS.length + 2);
  assert.deepEqual(
    queues.slice(2).map(({ options }) => options.arguments['x-message-ttl']),
    [...RETRY_DELAYS_MS],
  );
  assert.ok(queues.every(({ options }) => options.durable));
  assert.ok(
    queues.every(
      ({ options }) => options.arguments['x-queue-type'] === 'quorum',
    ),
  );
  assert.ok(
    bindings.some(
      ({ exchange, queue, routingKey }) =>
        exchange === MARKETPLACE_DEAD_LETTER_EXCHANGE &&
        queue === MARKETPLACE_DEAD_LETTER_QUEUE &&
        routingKey === '#',
    ),
  );
  assert.ok(
    bindings.some(
      ({ exchange, queue, routingKey }) =>
        exchange === MARKETPLACE_EXCHANGE &&
        queue === 'payment.requests' &&
        routingKey === 'retry-return.payment.requests',
    ),
  );
  assert.ok(
    queues
      .slice(2)
      .every(
        ({ options }) =>
          options.arguments['x-dead-letter-routing-key'] ===
          'retry-return.payment.requests',
      ),
  );
});

test('AC-042: exhausted failures reach a confirmed inspectable safe DLQ @spec:AC-042', async () => {
  const { acknowledgements, channel, publications } = channelHarness();
  const exhausted = message(RETRY_DELAYS_MS.length);

  await handleDelivery(channel, 'payment.requests', exhausted, async () => {
    throw new Error('password=super-secret buyer@example.com');
  });

  assert.deepEqual(acknowledgements, [exhausted]);
  assert.equal(publications.length, 1);
  assert.equal(publications[0].exchange, MARKETPLACE_DEAD_LETTER_EXCHANGE);
  assert.equal(publications[0].options.mandatory, true);
  assert.equal(publications[0].options.persistent, true);
  assert.deepEqual(JSON.parse(publications[0].content), {
    correlationId: 'operation-1',
    eventId: 'event-1',
    eventType: 'payment.requested.v1',
    failedAt: JSON.parse(publications[0].content).failedAt,
    reason: 'CONSUMER_FAILED',
  });
  assert.doesNotMatch(
    publications[0].content.toString(),
    /password|buyer@example/i,
  );
});

test('AC-041: mandatory unroutable publications do not confirm success @spec:AC-041', async () => {
  const { channel, returned } = channelHarness();
  channel.publish = (_exchange, _routingKey, _content, options, callback) => {
    for (const listener of returned)
      listener({ properties: { messageId: options.messageId } });
    callback();
    return true;
  };

  await assert.rejects(
    publishConfirmed(
      channel,
      MARKETPLACE_EXCHANGE,
      'missing.route',
      Buffer.from('{}'),
      { messageId: 'event-1' },
    ),
    /unroutable event event-1/,
  );
});

test('AC-051: effects finish before manual acknowledgement @spec:AC-051', async () => {
  const { acknowledgements, channel, consumer } = channelHarness();
  let finishEffect;
  const effect = new Promise((resolve) => {
    finishEffect = resolve;
  });
  await consumeWithRetry(channel, 'payment.requests', async () => effect);
  const delivery = message();

  consumer().handler(delivery);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(consumer().options, { noAck: false });
  assert.deepEqual(acknowledgements, []);

  finishEffect();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(acknowledgements, [delivery]);
});
