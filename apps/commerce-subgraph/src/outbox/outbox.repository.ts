import { randomUUID } from 'node:crypto';

import { LockMode, raw, type EntityManager } from '@mikro-orm/core';

import { OutboxEvent } from '../persistence/entities/outbox-event.entity.ts';

export interface CheckoutRequestedEvent {
  checkoutId: string;
}

export interface OutboxRepository {
  enqueueCheckoutRequested(
    transaction: EntityManager,
    workflowId: string,
    event: CheckoutRequestedEvent,
  ): Promise<void>;
}

export class MikroOrmOutboxRepository implements OutboxRepository {
  async enqueueCheckoutRequested(
    transaction: EntityManager,
    workflowId: string,
    event: CheckoutRequestedEvent,
  ): Promise<void> {
    const outboxEvent = transaction.create(OutboxEvent, {
      id: randomUUID(),
      workflowId,
      eventType: 'checkout.requested',
      payload: event,
      occurredAt: new Date(),
    });
    transaction.persist(outboxEvent);
  }

  claimUnsent(
    transaction: EntityManager,
    limit: number,
  ): Promise<OutboxEvent[]> {
    return transaction.find(
      OutboxEvent,
      { sentAt: null },
      {
        limit,
        lockMode: LockMode.PESSIMISTIC_PARTIAL_WRITE,
        orderBy: { occurredAt: 'asc' },
      },
    );
  }

  async markPublicationAttempt(
    transaction: EntityManager,
    eventId: string,
    attemptedAt: Date,
  ): Promise<void> {
    await transaction.nativeUpdate(
      OutboxEvent,
      { id: eventId, sentAt: null },
      {
        lastPublicationAttemptAt: attemptedAt,
        publicationAttempts: raw('publication_attempts + 1'),
      },
    );
  }

  async markSent(
    transaction: EntityManager,
    eventId: string,
    sentAt: Date,
  ): Promise<void> {
    await transaction.nativeUpdate(
      OutboxEvent,
      { id: eventId, sentAt: null },
      { sentAt },
    );
  }
}
