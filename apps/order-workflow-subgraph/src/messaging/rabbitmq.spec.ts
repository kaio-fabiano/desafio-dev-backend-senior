import { EventEmitter } from 'node:events';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  connectRabbitMq,
  consumeWithRetry,
  handleDelivery,
  publishConfirmed,
  type RabbitMqConfirmChannel,
  type RabbitMqMessage,
} from './rabbitmq.ts';

const amqp = vi.hoisted(() => ({ connect: vi.fn() }));

vi.mock('amqplib', () => ({ connect: amqp.connect }));

describe('RabbitMQ delivery reliability', () => {
  beforeEach(() => {
    amqp.connect.mockReset();
  });

  it('closes an acquired connection when channel creation fails @spec:AC-230', async () => {
    const close = vi.fn(async () => undefined);
    amqp.connect.mockResolvedValue(
      Object.assign(new EventEmitter(), {
        close,
        createConfirmChannel: vi.fn(async () => {
          throw new Error('channel unavailable');
        }),
      }),
    );

    await expect(connectRabbitMq('amqp://test')).rejects.toThrow(
      'channel unavailable',
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it('contains transport error events so close can drive reconnection @spec:AC-230', async () => {
    const connection = Object.assign(new EventEmitter(), {
      close: vi.fn(async () => undefined),
      createConfirmChannel: vi.fn(),
    });
    const channel = Object.assign(new EventEmitter(), {
      assertExchange: vi.fn(async () => undefined),
      assertQueue: vi.fn(async () => undefined),
      bindQueue: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    });
    connection.createConfirmChannel.mockResolvedValue(channel);
    amqp.connect.mockResolvedValue(connection);

    const runtime = await connectRabbitMq('amqp://test');

    expect(() =>
      connection.emit('error', new Error('socket lost')),
    ).not.toThrow();
    expect(() =>
      channel.emit('error', new Error('channel lost')),
    ).not.toThrow();
    await runtime.close();
    await runtime.close();
    expect(channel.close).toHaveBeenCalledOnce();
    expect(connection.close).toHaveBeenCalledOnce();
  });

  it('still closes the connection when channel shutdown reports failure @spec:AC-230', async () => {
    const connection = Object.assign(new EventEmitter(), {
      close: vi.fn(async () => undefined),
      createConfirmChannel: vi.fn(),
    });
    const channel = Object.assign(new EventEmitter(), {
      assertExchange: vi.fn(async () => undefined),
      assertQueue: vi.fn(async () => undefined),
      bindQueue: vi.fn(async () => undefined),
      close: vi.fn(async () => {
        throw new Error('channel already closed');
      }),
    });
    connection.createConfirmChannel.mockResolvedValue(channel);
    amqp.connect.mockResolvedValue(connection);
    const runtime = await connectRabbitMq('amqp://test');

    await expect(runtime.close()).rejects.toThrow('channel already closed');
    expect(connection.close).toHaveBeenCalledOnce();
  });

  it('normalizes an invalid retry header into the first bounded retry @spec:AC-230', async () => {
    const { channel, published } = confirmChannel();
    const message = rabbitMessage({
      headers: { 'x-retry-attempt': -2 },
      messageId: 'event-230',
    });

    await handleDelivery(channel, 'orders.v1', message, async () => {
      throw new Error('transient failure');
    });

    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({
      exchange: 'marketplace.retry.v1',
      routingKey: 'orders.v1.1',
      properties: {
        headers: { 'x-retry-attempt': 1 },
        messageId: 'event-230',
      },
    });
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('assigns stable failure metadata instead of hot-looping a malformed delivery @spec:AC-230', async () => {
    const { channel, published } = confirmChannel();
    const message = rabbitMessage({ headers: {} });

    await handleDelivery(channel, 'orders.v1', message, async () => {
      throw new Error('invalid envelope');
    });

    expect(published).toHaveLength(1);
    expect(published[0]?.properties.messageId).toMatch(
      /^malformed-[0-9a-f]{32}$/,
    );
    expect(published[0]?.properties.correlationId).toBe(
      published[0]?.properties.messageId,
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('routes an exhausted delivery to the dead-letter exchange @spec:AC-230', async () => {
    const { channel, published } = confirmChannel();
    const message = rabbitMessage({
      correlationId: 'operation-230',
      headers: { 'x-retry-attempt': 3 },
      messageId: 'event-230',
      type: undefined,
    });

    await handleDelivery(channel, 'orders.v1', message, async () => {
      throw new Error('permanent failure');
    });

    expect(published[0]).toMatchObject({
      exchange: 'marketplace.dead-letter.v1',
      routingKey: 'payment.authorized',
      properties: {
        correlationId: 'operation-230',
        headers: { 'x-retry-attempt': 4 },
        messageId: 'event-230',
      },
    });
    expect(JSON.parse(String(published[0]?.content))).toMatchObject({
      correlationId: 'operation-230',
      eventId: 'event-230',
      eventType: 'payment.authorized',
      reason: 'CONSUMER_FAILED',
    });
  });

  it('caps an oversized retry header before dead-letter publication @spec:AC-230', async () => {
    const { channel, published } = confirmChannel();
    const message = rabbitMessage({
      correlationId: 'operation-230',
      headers: { 'x-retry-attempt': Number.MAX_SAFE_INTEGER },
      messageId: 'event-230',
    });

    await handleDelivery(channel, 'orders.v1', message, async () => {
      throw new Error('permanent failure');
    });

    expect(published[0]?.properties.headers).toEqual({
      'x-retry-attempt': 4,
    });
  });

  it('rejects a publisher nack and a synchronous publish failure @spec:AC-230', async () => {
    const { channel } = confirmChannel(new Error('broker nack'));
    await expect(
      publishConfirmed(channel, 'exchange', 'route', Buffer.from('event'), {
        messageId: 'event-230',
      }),
    ).rejects.toThrow('broker nack');

    channel.publish = () => {
      throw new Error('channel closed');
    };
    await expect(
      publishConfirmed(channel, 'exchange', 'route', Buffer.from('event'), {
        messageId: 'event-230',
      }),
    ).rejects.toThrow('channel closed');
  });

  it('nacks the original when retry publication is not confirmed @spec:AC-230', async () => {
    const { channel } = confirmChannel(new Error('retry nack'));
    let delivery: ((message: RabbitMqMessage | null) => void) | undefined;
    channel.prefetch = vi.fn(async () => ({}));
    channel.consume = vi.fn(async (_queue, callback) => {
      delivery = callback;
      return { consumerTag: 'consumer-230' };
    });
    channel.nack = vi.fn();
    const message = rabbitMessage({ messageId: 'event-230' });

    await consumeWithRetry(channel, 'orders.v1', async () => {
      throw new Error('handler failed');
    });
    delivery?.(null);
    delivery?.(message);
    await new Promise((resolve) => setImmediate(resolve));

    expect(channel.nack).toHaveBeenCalledWith(message, false, true);
  });
});

function confirmChannel(confirmationError: Error | null = null): {
  channel: RabbitMqConfirmChannel;
  published: Array<{
    exchange: string;
    content: Buffer;
    properties: Record<string, unknown>;
    routingKey: string;
  }>;
} {
  const emitter = new EventEmitter();
  const published: Array<{
    exchange: string;
    content: Buffer;
    properties: Record<string, unknown>;
    routingKey: string;
  }> = [];
  const channel = Object.assign(emitter, {
    ack: vi.fn(),
    publish(
      exchange: string,
      routingKey: string,
      content: Buffer,
      properties: Record<string, unknown>,
      confirmed: (error: Error | null) => void,
    ) {
      published.push({ content, exchange, properties, routingKey });
      confirmed(confirmationError);
      return true;
    },
  }) as unknown as RabbitMqConfirmChannel;
  return { channel, published };
}

function rabbitMessage(
  properties: Partial<RabbitMqMessage['properties']>,
): RabbitMqMessage {
  return {
    content: Buffer.from('{"invalid":true}'),
    fields: {
      consumerTag: 'consumer-230',
      deliveryTag: 1,
      redelivered: false,
      exchange: 'marketplace.events.v1',
      routingKey: 'payment.authorized',
    },
    properties: {
      contentType: 'application/json',
      contentEncoding: undefined,
      headers: {},
      deliveryMode: 2,
      priority: undefined,
      correlationId: undefined,
      replyTo: undefined,
      expiration: undefined,
      messageId: undefined,
      timestamp: undefined,
      type: 'payment.authorized',
      userId: undefined,
      appId: undefined,
      clusterId: undefined,
      ...properties,
    },
  };
}
