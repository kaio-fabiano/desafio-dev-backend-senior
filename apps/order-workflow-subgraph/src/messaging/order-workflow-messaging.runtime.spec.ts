import { EventEmitter } from 'node:events';

import type { EntityManager, MikroORM } from '@mikro-orm/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  OrderWorkflowRuntimeLifecycle,
  startOrderWorkflowMessaging,
} from './order-workflow-messaging.runtime.ts';
import type {
  RabbitMqConfirmChannel,
  RabbitMqMessage,
  RabbitMqRuntime,
} from './rabbitmq.ts';

const rabbit = vi.hoisted(() => ({
  connectRabbitMq: vi.fn(),
  consumeWithRetry: vi.fn(),
  declareConsumerQueue: vi.fn(),
}));

vi.mock('./rabbitmq.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./rabbitmq.ts')>()),
  connectRabbitMq: rabbit.connectRabbitMq,
  consumeWithRetry: rabbit.consumeWithRetry,
  declareConsumerQueue: rabbit.declareConsumerQueue,
}));

describe('OrderWorkflow messaging runtime', () => {
  beforeEach(() => {
    rabbit.connectRabbitMq.mockReset();
    rabbit.consumeWithRetry.mockReset().mockResolvedValue({
      consumerTag: 'consumer-230',
    });
    rabbit.declareConsumerQueue.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('starts isolated channels, consumes duplicates, and closes once @spec:AC-230', async () => {
    const runtimes = [fakeRabbit(), fakeRabbit(), fakeRabbit()];
    rabbit.connectRabbitMq.mockResolvedValueOnce(runtimes[0]);
    rabbit.connectRabbitMq.mockResolvedValueOnce(runtimes[1]);
    rabbit.connectRabbitMq.mockResolvedValueOnce(runtimes[2]);
    const disconnected = vi.fn();
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const runtime = await startOrderWorkflowMessaging({
      orm: fakeOrm([], true),
      rabbitMqUrl: 'amqp://test',
      onDisconnected: disconnected,
    });
    const handler = rabbit.consumeWithRetry.mock.calls[0]?.[2];

    await handler?.(rabbitMessage());
    runtimes[0].channel.emit('close');
    await runtime.close();
    await runtime.close();

    expect(rabbit.connectRabbitMq).toHaveBeenCalledTimes(3);
    expect(rabbit.declareConsumerQueue).toHaveBeenCalledOnce();
    expect(rabbit.consumeWithRetry).toHaveBeenCalledOnce();
    expect(disconnected).toHaveBeenCalledOnce();
    expect(runtimes.every(({ close }) => close.mock.calls.length === 1)).toBe(
      true,
    );
  });

  it('closes earlier connections after a partial startup failure @spec:AC-230', async () => {
    const first = fakeRabbit();
    rabbit.connectRabbitMq
      .mockResolvedValueOnce(first)
      .mockRejectedValueOnce(new Error('broker unavailable'));

    await expect(
      startOrderWorkflowMessaging({
        orm: fakeOrm(),
        rabbitMqUrl: 'amqp://test',
      }),
    ).rejects.toThrow('broker unavailable');
    expect(first.close).toHaveBeenCalledOnce();
  });

  it.each([
    ['queue declaration', rabbit.declareConsumerQueue],
    ['consumer registration', rabbit.consumeWithRetry],
  ])(
    'closes every connection after %s fails @spec:AC-230',
    async (_name, failure) => {
      const runtimes = [fakeRabbit(), fakeRabbit(), fakeRabbit()];
      runtimes.forEach((runtime) =>
        rabbit.connectRabbitMq.mockResolvedValueOnce(runtime),
      );
      failure.mockRejectedValueOnce(new Error('setup failed'));

      await expect(
        startOrderWorkflowMessaging({
          orm: fakeOrm(),
          rabbitMqUrl: 'amqp://test',
        }),
      ).rejects.toThrow('setup failed');
      expect(runtimes.every(({ close }) => close.mock.calls.length === 1)).toBe(
        true,
      );
    },
  );

  it('survives an outbox publication failure until shutdown @spec:AC-230', async () => {
    const runtimes = [fakeRabbit(), fakeRabbit(), fakeRabbit()];
    runtimes.forEach((runtime) =>
      rabbit.connectRabbitMq.mockResolvedValueOnce(runtime),
    );
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const runtime = await startOrderWorkflowMessaging({
      orm: fakeOrm([
        {
          id: 'invalid-event',
          workflowId: 'workflow-230',
          eventType: 'payment.requested',
          payload: {},
          occurredAt: new Date(),
          publicationAttempts: 0,
        },
      ]),
      rabbitMqUrl: 'amqp://test',
    });

    await new Promise((resolve) => setImmediate(resolve));
    await runtime.close();

    expect(consoleError).toHaveBeenCalledWith(
      'OrderWorkflow outbox publication failed',
      expect.any(Error),
    );
  });

  it('reports a consumer failure and leaves retry routing to the delivery layer @spec:AC-230', async () => {
    const runtimes = [fakeRabbit(), fakeRabbit(), fakeRabbit()];
    runtimes.forEach((runtime) =>
      rabbit.connectRabbitMq.mockResolvedValueOnce(runtime),
    );
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    const runtime = await startOrderWorkflowMessaging({
      orm: fakeOrm([], true),
      rabbitMqUrl: 'amqp://test',
    });
    const handler = rabbit.consumeWithRetry.mock.calls[0]?.[2];
    const message = rabbitMessage();
    message.content = Buffer.from(
      JSON.stringify({
        eventId: 'c0000000-0000-4000-8000-000000000231',
        eventType: 'payment.authorized',
        payload: { operationKey: 'operation-230', orderId: 'order-230' },
      }),
    );

    await expect(handler?.(message)).rejects.toThrow('paymentId');
    await runtime.close();
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('"status":"failed"'),
    );
  });

  it('reconnects after channel close and closes the ORM during shutdown @spec:AC-230', async () => {
    vi.useFakeTimers();
    const runtimes = Array.from({ length: 6 }, () => fakeRabbit());
    runtimes.forEach((runtime) =>
      rabbit.connectRabbitMq.mockResolvedValueOnce(runtime),
    );
    const orm = fakeOrm();
    const lifecycle = new OrderWorkflowRuntimeLifecycle(orm);

    await lifecycle.onApplicationBootstrap();
    expect(lifecycle.connected).toBe(true);
    runtimes[0].channel.emit('close');
    expect(lifecycle.connected).toBe(false);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(lifecycle.connected).toBe(true);
    expect(rabbit.connectRabbitMq).toHaveBeenCalledTimes(6);

    await lifecycle.onApplicationShutdown();
    expect(orm.close).toHaveBeenCalledWith(true);
    expect(lifecycle.connected).toBe(false);
  });

  it('cancels a scheduled reconnect during shutdown @spec:AC-230', async () => {
    vi.useFakeTimers();
    const runtimes = [fakeRabbit(), fakeRabbit(), fakeRabbit()];
    runtimes.forEach((runtime) =>
      rabbit.connectRabbitMq.mockResolvedValueOnce(runtime),
    );
    const lifecycle = new OrderWorkflowRuntimeLifecycle(fakeOrm());
    await lifecycle.onApplicationBootstrap();

    runtimes[0].channel.emit('close');
    await lifecycle.onApplicationShutdown();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(rabbit.connectRabbitMq).toHaveBeenCalledTimes(3);
    expect(lifecycle.connected).toBe(false);
  });

  it('retries a failed reconnect after cleaning up the disconnected runtime @spec:AC-230', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const original = [fakeRabbit(), fakeRabbit(), fakeRabbit()];
    original.forEach((runtime) =>
      rabbit.connectRabbitMq.mockResolvedValueOnce(runtime),
    );
    original[0].close.mockRejectedValueOnce(new Error('already disconnected'));
    rabbit.connectRabbitMq.mockRejectedValueOnce(new Error('broker offline'));
    const recovered = [fakeRabbit(), fakeRabbit(), fakeRabbit()];
    recovered.forEach((runtime) =>
      rabbit.connectRabbitMq.mockResolvedValueOnce(runtime),
    );
    const lifecycle = new OrderWorkflowRuntimeLifecycle(fakeOrm());
    await lifecycle.onApplicationBootstrap();

    original[0].channel.emit('close');
    await vi.advanceTimersByTimeAsync(1_000);
    expect(lifecycle.connected).toBe(false);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(lifecycle.connected).toBe(true);

    await lifecycle.onApplicationShutdown();
    expect(rabbit.connectRabbitMq).toHaveBeenCalledTimes(7);
  });
});

function fakeRabbit(): RabbitMqRuntime & { close: ReturnType<typeof vi.fn> } {
  return {
    channel: new EventEmitter() as RabbitMqConfirmChannel,
    close: vi.fn(async () => undefined),
  };
}

function fakeOrm(
  events: unknown[] = [],
  applySaga = false,
): MikroORM & {
  close: ReturnType<typeof vi.fn>;
} {
  const execute = vi.fn(async (sql: string) => {
    if (!applySaga) return [];
    if (sql.includes('returning "event_id"'))
      return [{ event_id: 'event-230' }];
    if (sql.includes('for update'))
      return [
        {
          id: 'workflow-230',
          woo_order_id: 'order-230',
          state: 'CREATED',
          operation_key: 'operation-230',
          subject: 'buyer-230',
        },
      ];
    if (sql.includes('select "stock_items"'))
      return [{ stock_items: [{ productId: 'product-230', quantity: 1 }] }];
    return [];
  });
  const transaction = {
    find: vi.fn(async () => events),
    getConnection: () => ({ execute }),
    getTransactionContext: () => undefined,
    nativeUpdate: vi.fn(async () => 1),
  } as unknown as EntityManager;
  const entityManager = {
    fork: () => entityManager,
    transactional: <T>(work: (em: EntityManager) => Promise<T>) =>
      work(transaction),
  } as unknown as EntityManager;
  return {
    close: vi.fn(async () => undefined),
    em: entityManager,
  } as unknown as MikroORM & { close: ReturnType<typeof vi.fn> };
}

function rabbitMessage(): RabbitMqMessage {
  return {
    content: Buffer.from(
      JSON.stringify({
        eventId: 'c0000000-0000-4000-8000-000000000230',
        eventType: 'payment.authorized',
        payload: {
          operationKey: 'operation-230',
          orderId: 'order-230',
          paymentId: 'payment-230',
          providerReference: 'provider-230',
        },
      }),
    ),
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
      correlationId: 'operation-230',
      replyTo: undefined,
      expiration: undefined,
      messageId: 'c0000000-0000-4000-8000-000000000230',
      timestamp: undefined,
      type: 'payment.authorized',
      userId: undefined,
      appId: undefined,
      clusterId: undefined,
    },
  };
}
