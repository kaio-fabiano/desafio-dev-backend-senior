import type { ConfirmChannel, Message, Options } from 'amqplib';

export const MARKETPLACE_EXCHANGE = 'marketplace.events.v1';
export const MARKETPLACE_RETRY_EXCHANGE = 'marketplace.retry.v1';
export const MARKETPLACE_DEAD_LETTER_EXCHANGE = 'marketplace.dead-letter.v1';
export const MARKETPLACE_DEAD_LETTER_QUEUE = 'marketplace.dead-letter.v1';
export const RETRY_DELAYS_MS = [1_000, 10_000, 60_000] as const;

export type RabbitMqMessage = Message;
export type RabbitMqConfirmChannel = ConfirmChannel;

export interface MarketplaceEvent {
  eventId: string;
  eventType: string;
  eventVersion: 'v1';
  occurredAt: string;
  operationKey: string;
  payload: Record<string, unknown>;
  traceContext: { traceId: string; spanId?: string };
}

export interface PaymentRequestedEvent extends MarketplaceEvent {
  eventType: 'payment.requested';
  payload: {
    checkoutId?: string;
    paymentId: string;
    orderId: string;
    method: 'CARD' | 'PIX';
    amount: number;
    currency: string;
    providerToken?: string;
    payerEmail: string;
    paymentMethodId?: string;
  };
}

export interface PaymentAuthorizedEvent extends MarketplaceEvent {
  eventType: 'payment.authorized';
  payload: {
    paymentId: string;
    orderId: string;
    providerReference: string;
  };
}

export interface PaymentPixGeneratedEvent extends MarketplaceEvent {
  eventType: 'payment.pix-generated';
  payload: {
    paymentId: string;
    orderId: string;
    providerReference: string;
    pixCode: string;
  };
}

export interface OrderWorkflowTransitionedEvent extends MarketplaceEvent {
  eventType: 'order.workflow-transitioned';
  eventVersion: 'v1';
  operationKey: string;
  subject: string;
  traceContext: { traceId: string; spanId?: string };
  payload: {
    eventTime: string;
    operationKey: string;
    orderId: string;
    pixCode?: string;
    state: string;
  };
}

export interface RabbitMqRuntime {
  channel: RabbitMqConfirmChannel;
  close(): Promise<void>;
}

export async function connectRabbitMq(url: string): Promise<RabbitMqRuntime> {
  const { connect } = await import('amqplib');
  const connection = await connect(url);
  const nativeChannel = await connection.createConfirmChannel();
  const channel = nativeChannel as unknown as RabbitMqConfirmChannel;
  await declareRabbitMqTopology(channel);

  return {
    channel,
    async close() {
      const results = await Promise.allSettled([
        nativeChannel.close(),
        connection.close(),
      ]);
      const failure = results.find(
        (result): result is PromiseRejectedResult =>
          result.status === 'rejected',
      );
      if (failure) throw failure.reason;
    },
  };
}

export async function declareRabbitMqTopology(
  channel: RabbitMqConfirmChannel,
): Promise<void> {
  await channel.assertExchange(MARKETPLACE_EXCHANGE, 'topic', {
    durable: true,
  });
  await channel.assertExchange(MARKETPLACE_RETRY_EXCHANGE, 'direct', {
    durable: true,
  });
  await channel.assertExchange(MARKETPLACE_DEAD_LETTER_EXCHANGE, 'topic', {
    durable: true,
  });

  await channel.assertQueue(MARKETPLACE_DEAD_LETTER_QUEUE, {
    durable: true,
    arguments: { 'x-queue-type': 'quorum' },
  });
  await channel.bindQueue(
    MARKETPLACE_DEAD_LETTER_QUEUE,
    MARKETPLACE_DEAD_LETTER_EXCHANGE,
    '#',
  );
}

export async function declareConsumerQueue(
  channel: RabbitMqConfirmChannel,
  queue: string,
  routingKeys: readonly string[],
): Promise<void> {
  await channel.assertQueue(queue, {
    durable: true,
    arguments: { 'x-queue-type': 'quorum' },
  });
  for (const routingKey of routingKeys) {
    await channel.bindQueue(queue, MARKETPLACE_EXCHANGE, routingKey);
  }
  await channel.bindQueue(queue, MARKETPLACE_EXCHANGE, retryReturnKey(queue));

  for (const [index, delay] of RETRY_DELAYS_MS.entries()) {
    const attempt = index + 1;
    const queueName = retryQueue(queue, attempt);
    await channel.assertQueue(queueName, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': MARKETPLACE_EXCHANGE,
        'x-dead-letter-routing-key': retryReturnKey(queue),
        'x-message-ttl': delay,
        'x-queue-type': 'quorum',
      },
    });
    await channel.bindQueue(
      queueName,
      MARKETPLACE_RETRY_EXCHANGE,
      retryRoutingKey(queue, attempt),
    );
  }
}

export async function publishConfirmed(
  channel: RabbitMqConfirmChannel,
  exchange: string,
  routingKey: string,
  content: Buffer,
  properties: Options.Publish & { messageId: string },
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    let returned = false;
    const onReturn = (message: RabbitMqMessage) => {
      if (message.properties.messageId === properties.messageId)
        returned = true;
    };
    const finish = (error?: Error | null) => {
      channel.removeListener('return', onReturn);
      if (error) reject(error);
      else if (returned)
        reject(
          new Error(
            `RabbitMQ returned unroutable event ${properties.messageId}`,
          ),
        );
      else resolve();
    };

    channel.on('return', onReturn);
    try {
      channel.publish(
        exchange,
        routingKey,
        content,
        { ...properties, mandatory: true, persistent: true },
        finish,
      );
    } catch (error) {
      channel.removeListener('return', onReturn);
      reject(error);
    }
  });
}

export class ConfirmedRabbitMqPublisher {
  constructor(private readonly channel: RabbitMqConfirmChannel) {}

  publish(event: MarketplaceEvent): Promise<void> {
    return publishConfirmed(
      this.channel,
      MARKETPLACE_EXCHANGE,
      event.eventType,
      Buffer.from(JSON.stringify(event)),
      {
        contentType: 'application/json',
        correlationId: event.operationKey,
        headers: {
          traceparent: `00-${event.traceContext.traceId}-${event.traceContext.spanId ?? event.traceContext.traceId.slice(0, 16)}-01`,
        },
        messageId: event.eventId,
        timestamp: Date.parse(event.occurredAt),
        type: event.eventType,
      },
    );
  }
}

export async function handleDelivery(
  consumerChannel: RabbitMqConfirmChannel,
  queue: string,
  message: RabbitMqMessage,
  handler: (message: RabbitMqMessage) => Promise<void>,
  failureChannel: RabbitMqConfirmChannel = consumerChannel,
): Promise<void> {
  try {
    await handler(message);
  } catch {
    await routeFailedDelivery(failureChannel, queue, message);
  }
  consumerChannel.ack(message);
}

export async function consumeWithRetry(
  channel: RabbitMqConfirmChannel,
  queue: string,
  handler: (message: RabbitMqMessage) => Promise<void>,
  prefetch = 10,
  failureChannel: RabbitMqConfirmChannel = channel,
): Promise<unknown> {
  await channel.prefetch(prefetch);
  return channel.consume(
    queue,
    (message) => {
      if (!message) return;
      void handleDelivery(
        channel,
        queue,
        message,
        handler,
        failureChannel,
      ).catch(() => {
        channel.nack(message, false, true);
      });
    },
    { noAck: false },
  );
}

async function routeFailedDelivery(
  channel: RabbitMqConfirmChannel,
  queue: string,
  message: RabbitMqMessage,
): Promise<void> {
  const attempt = Number(message.properties.headers?.['x-retry-attempt'] ?? 0);
  const nextAttempt = attempt + 1;

  if (nextAttempt <= RETRY_DELAYS_MS.length) {
    await publishConfirmed(
      channel,
      MARKETPLACE_RETRY_EXCHANGE,
      retryRoutingKey(queue, nextAttempt),
      message.content,
      {
        ...message.properties,
        headers: {
          ...message.properties.headers,
          'x-retry-attempt': nextAttempt,
        },
        messageId: requiredIdentifier(message.properties.messageId, 'event'),
      },
    );
    return;
  }

  const eventId = requiredIdentifier(message.properties.messageId, 'event');
  const correlationId = requiredIdentifier(
    message.properties.correlationId,
    'correlation',
  );
  const deadLetter = Buffer.from(
    JSON.stringify({
      correlationId,
      eventId,
      eventType: message.properties.type ?? message.fields.routingKey,
      failedAt: new Date().toISOString(),
      reason: 'CONSUMER_FAILED',
    }),
  );
  await publishConfirmed(
    channel,
    MARKETPLACE_DEAD_LETTER_EXCHANGE,
    message.properties.type ?? message.fields.routingKey,
    deadLetter,
    {
      contentType: 'application/json',
      correlationId,
      headers: { 'x-retry-attempt': nextAttempt },
      messageId: eventId,
      type: message.properties.type,
    },
  );
}

function retryQueue(queue: string, attempt: number): string {
  return `${queue}.retry.${attempt}`;
}

function retryRoutingKey(queue: string, attempt: number): string {
  return `${queue}.${attempt}`;
}

function retryReturnKey(queue: string): string {
  return `retry-return.${queue}`;
}

function requiredIdentifier(value: string | undefined, name: string): string {
  if (!value) throw new Error(`RabbitMQ message is missing ${name} metadata`);
  return value;
}
