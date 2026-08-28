import type { ConfirmChannel, ConsumeMessage } from 'amqplib';

import type { InventoryResult } from '../inventory/inbox.repository.ts';
import type { StockReservationRequested } from '../inventory/inventory.service.ts';

const EVENTS = 'marketplace.events.v1';
const RETRY = 'marketplace.retry.v1';
const DEAD_LETTER = 'marketplace.dead-letter.v1';
const QUEUE = 'stock-worker.v1';
const RETRY_DELAYS = [1_000, 10_000, 60_000] as const;

export type StockDelivery = {
  eventId: string;
  eventType: 'stock.reservation-requested';
  eventVersion: 'v1';
  operationKey: string;
  correlationId: string;
  occurredAt: string;
  payload: StockReservationRequested['payload'];
};

export async function connectStockBroker(url: string) {
  const { connect } = await import('amqplib');
  const connection = await connect(url);
  const channel = await connection.createConfirmChannel();
  await declareTopology(channel);
  return {
    channel,
    async close(): Promise<void> {
      await channel.close();
      await connection.close();
    },
  };
}

async function declareTopology(channel: ConfirmChannel): Promise<void> {
  await channel.assertExchange(EVENTS, 'topic', { durable: true });
  await channel.assertExchange(RETRY, 'direct', { durable: true });
  await channel.assertExchange(DEAD_LETTER, 'topic', { durable: true });
  await channel.assertQueue(QUEUE, {
    durable: true,
    arguments: { 'x-queue-type': 'quorum' },
  });
  await channel.bindQueue(QUEUE, EVENTS, 'stock.reservation-requested');
  await channel.bindQueue(QUEUE, EVENTS, `retry-return.${QUEUE}`);
  for (const [index, delay] of RETRY_DELAYS.entries()) {
    const attempt = index + 1;
    const retryQueue = `${QUEUE}.retry.${attempt}`;
    await channel.assertQueue(retryQueue, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': EVENTS,
        'x-dead-letter-routing-key': `retry-return.${QUEUE}`,
        'x-message-ttl': delay,
        'x-queue-type': 'quorum',
      },
    });
    await channel.bindQueue(retryQueue, RETRY, `${QUEUE}.${attempt}`);
  }
}

export async function consumeStock(
  consumerChannel: ConfirmChannel,
  handler: (event: StockDelivery) => Promise<void>,
  failureChannel: ConfirmChannel = consumerChannel,
): Promise<void> {
  await consumerChannel.prefetch(1);
  await consumerChannel.consume(
    QUEUE,
    (message) => {
      if (!message) return;
      void handle(consumerChannel, failureChannel, message, handler).catch(() =>
        consumerChannel.nack(message, false, true),
      );
    },
    { noAck: false },
  );
}

async function handle(
  consumerChannel: ConfirmChannel,
  failureChannel: ConfirmChannel,
  message: ConsumeMessage,
  handler: (event: StockDelivery) => Promise<void>,
): Promise<void> {
  const eventId = message.properties.messageId ?? 'unknown';
  console.info(
    JSON.stringify({ component: 'stock-worker', eventId, status: 'received' }),
  );
  try {
    await handler(
      JSON.parse(message.content.toString('utf8')) as StockDelivery,
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        component: 'stock-worker',
        eventId,
        status: 'failed',
        error: error instanceof Error ? error.message : 'unknown error',
      }),
    );
    await routeFailure(failureChannel, message);
  }
  consumerChannel.ack(message);
  console.info(
    JSON.stringify({ component: 'stock-worker', eventId, status: 'completed' }),
  );
}

async function routeFailure(
  channel: ConfirmChannel,
  message: ConsumeMessage,
): Promise<void> {
  const attempt =
    Number(message.properties.headers?.['x-retry-attempt'] ?? 0) + 1;
  if (attempt <= RETRY_DELAYS.length) {
    await publish(
      channel,
      RETRY,
      `${QUEUE}.${attempt}`,
      message.content,
      {
        ...message.properties.headers,
        'x-retry-attempt': attempt,
      },
      required(message.properties.messageId, 'eventId'),
      message.properties.type,
    );
    return;
  }
  const failure = Buffer.from(
    JSON.stringify({
      eventId: required(message.properties.messageId, 'eventId'),
      eventType: message.properties.type ?? message.fields.routingKey,
      correlationId: required(
        message.properties.correlationId,
        'correlationId',
      ),
      failedAt: new Date().toISOString(),
      reason: 'CONSUMER_FAILED',
    }),
  );
  await publish(
    channel,
    DEAD_LETTER,
    message.properties.type ?? message.fields.routingKey,
    failure,
    { 'x-retry-attempt': attempt },
    required(message.properties.messageId, 'eventId'),
    message.properties.type,
  );
}

export function publishInventory(
  channel: ConfirmChannel,
  result: InventoryResult,
): Promise<void> {
  return publish(
    channel,
    EVENTS,
    result.eventType,
    Buffer.from(
      JSON.stringify({
        ...result,
        correlationId: result.operationKey,
      }),
    ),
    {},
    result.eventId,
    result.eventType,
  );
}

function publish(
  channel: ConfirmChannel,
  exchange: string,
  routingKey: string,
  content: Buffer,
  headers: Record<string, unknown>,
  messageId: string,
  type?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    channel.publish(
      exchange,
      routingKey,
      content,
      {
        contentType: 'application/json',
        persistent: true,
        mandatory: true,
        headers,
        messageId,
        correlationId: messageId,
        type,
      },
      (error) => (error ? reject(error) : resolve()),
    );
  });
}

function required(value: string | undefined, field: string): string {
  if (!value) throw new Error(`RabbitMQ message is missing ${field}`);
  return value;
}
