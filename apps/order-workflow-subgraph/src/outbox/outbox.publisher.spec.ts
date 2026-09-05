import type { EntityManager } from '@mikro-orm/core';
import { describe, expect, it, vi } from 'vitest';

import { OutboxPublisher } from './outbox.publisher.ts';
import type { OutboxEvent } from '../persistence/entities/outbox-event.entity.ts';

describe('OutboxPublisher', () => {
  it('marks only broker-confirmed events as sent @spec:AC-230', async () => {
    const events = [outboxEvent('event-1'), outboxEvent('event-2')];
    const markPublicationAttempt = vi.fn(async () => undefined);
    const markSent = vi.fn(async () => undefined);
    const publish = vi.fn(async ({ eventId }: { eventId: string }) => {
      if (eventId === 'event-1') throw new Error('broker nack');
    });
    const publisher = new OutboxPublisher(
      transactionManager(),
      {
        claimUnsent: vi.fn(async () => events),
        markPublicationAttempt,
        markSent,
      },
      { publish },
    );

    await expect(publisher.publishBatch(2)).rejects.toThrow('broker nack');

    expect(markPublicationAttempt).toHaveBeenCalledTimes(2);
    expect(publish).toHaveBeenCalledTimes(2);
    expect(markSent).toHaveBeenCalledOnce();
    expect(markSent).toHaveBeenCalledWith(
      expect.anything(),
      'event-2',
      expect.any(Date),
    );
  });

  it('publishes the versioned envelope and removes private operation metadata @spec:AC-230', async () => {
    const event = outboxEvent('event-230');
    const publish = vi.fn(async () => undefined);
    const publisher = new OutboxPublisher(
      transactionManager(),
      {
        claimUnsent: vi.fn(async () => [event]),
        markPublicationAttempt: vi.fn(async () => undefined),
        markSent: vi.fn(async () => undefined),
      },
      { publish },
    );

    await expect(publisher.publishBatch()).resolves.toBe(1);
    expect(publish).toHaveBeenCalledWith({
      eventId: 'event-230',
      eventType: 'payment.requested',
      eventVersion: 'v1',
      occurredAt: '2026-09-05T12:00:00.000Z',
      operationKey: 'operation-230',
      payload: { orderId: 'order-230' },
      traceContext: { traceId: expect.stringMatching(/^[0-9a-f]{32}$/) },
    });
  });

  it('keeps malformed events unsent for operator repair @spec:AC-230', async () => {
    const event = outboxEvent('event-invalid');
    event.payload = { orderId: 'order-230' };
    const markSent = vi.fn(async () => undefined);
    const publisher = new OutboxPublisher(
      transactionManager(),
      {
        claimUnsent: vi.fn(async () => [event]),
        markPublicationAttempt: vi.fn(async () => undefined),
        markSent,
      },
      { publish: vi.fn(async () => undefined) },
    );

    await expect(publisher.publishBatch()).rejects.toThrow(
      'OrderWorkflow outbox event event-invalid has no operation key',
    );
    expect(markSent).not.toHaveBeenCalled();
  });
});

function transactionManager(): EntityManager {
  const transaction = {} as EntityManager;
  return {
    transactional: async <T>(work: (em: EntityManager) => Promise<T>) =>
      work(transaction),
  } as EntityManager;
}

function outboxEvent(id: string): OutboxEvent {
  return {
    id,
    workflowId: 'workflow-230',
    eventType: 'payment.requested',
    payload: { operationKey: 'operation-230', orderId: 'order-230' },
    occurredAt: new Date('2026-09-05T12:00:00.000Z'),
    publicationAttempts: 0,
  };
}
