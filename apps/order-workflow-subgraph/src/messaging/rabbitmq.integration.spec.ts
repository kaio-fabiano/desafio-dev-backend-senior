import { randomUUID } from 'node:crypto';

import {
  GenericContainer,
  Wait,
  type StartedTestContainer,
} from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  ConfirmedRabbitMqPublisher,
  connectRabbitMq,
  consumeWithRetry,
  declareConsumerQueue,
  type MarketplaceEvent,
  type RabbitMqRuntime,
} from './rabbitmq.ts';

describe('RabbitMQ confirmed delivery', () => {
  let container: StartedTestContainer;
  let rabbitMqUrl: string;
  const runtimes: RabbitMqRuntime[] = [];

  beforeAll(async () => {
    container = await new GenericContainer('rabbitmq:4.1.3-management')
      .withExposedPorts(5672)
      .withWaitStrategy(Wait.forLogMessage(/Server startup complete/))
      .start();
    rabbitMqUrl = `amqp://guest:guest@${container.getHost()}:${container.getMappedPort(5672)}`;
  }, 60_000);

  afterAll(async () => {
    await Promise.allSettled(runtimes.map((runtime) => runtime.close()));
    await container?.stop();
  });

  it('confirms a persistent event and retries it after a failed delivery @spec:AC-230', async () => {
    const consumer = await runtime();
    const failurePublisher = await runtime();
    const publisher = await runtime();
    const queue = `order-workflow-ac230-${randomUUID()}`;
    await declareConsumerQueue(consumer.channel, queue, ['payment.authorized']);
    let attempts = 0;
    let complete: () => void = () => undefined;
    const delivered = new Promise<void>((resolve) => {
      complete = resolve;
    });
    await consumeWithRetry(
      consumer.channel,
      queue,
      async (message) => {
        attempts += 1;
        if (attempts === 1) throw new Error('transient consumer failure');
        expect(JSON.parse(message.content.toString('utf8'))).toMatchObject({
          eventId: 'b0000000-0000-4000-8000-000000000230',
          eventType: 'payment.authorized',
        });
        complete();
      },
      1,
      failurePublisher.channel,
    );

    await new ConfirmedRabbitMqPublisher(publisher.channel).publish(
      marketplaceEvent('payment.authorized'),
    );
    await expect(
      Promise.race([
        delivered,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('delivery timed out')), 5_000),
        ),
      ]),
    ).resolves.toBeUndefined();
    expect(attempts).toBe(2);
  }, 10_000);

  it('rejects a confirmed mandatory publish that has no route @spec:AC-230', async () => {
    const publisher = await runtime();

    await expect(
      new ConfirmedRabbitMqPublisher(publisher.channel).publish(
        marketplaceEvent(`unroutable.${randomUUID()}`),
      ),
    ).rejects.toThrow('returned unroutable event');
  });

  async function runtime(): Promise<RabbitMqRuntime> {
    const connected = await connectRabbitMq(rabbitMqUrl);
    runtimes.push(connected);
    return connected;
  }
});

function marketplaceEvent(eventType: string): MarketplaceEvent {
  return {
    eventId: 'b0000000-0000-4000-8000-000000000230',
    eventType,
    eventVersion: 'v1',
    occurredAt: '2026-09-05T12:00:00.000Z',
    operationKey: 'operation-230',
    payload: { orderId: 'order-230' },
    traceContext: { traceId: '1'.repeat(32), spanId: '2'.repeat(16) },
  };
}
