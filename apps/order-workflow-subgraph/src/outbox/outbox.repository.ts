import { randomUUID } from 'node:crypto';

import { LockMode, raw, type EntityManager } from '@mikro-orm/core';

import { OutboxEvent } from '../persistence/entities/outbox-event.entity.ts';

export interface CheckoutRequestedEvent {
  checkoutId: string;
  operationKey: string;
  paymentId: string;
  orderId: string;
  method: string;
  amount: number;
  currency: string;
  payerEmail: string;
  providerToken?: string;
  paymentMethodId?: string;
}

export interface OutboxRepository {
  enqueueCheckoutRequested(
    transaction: unknown,
    workflowId: string,
    event: CheckoutRequestedEvent,
  ): Promise<void>;
}

export class MikroOrmOutboxRepository implements OutboxRepository {
  async enqueueCheckoutRequested(
    context: unknown,
    workflowId: string,
    event: CheckoutRequestedEvent,
  ): Promise<void> {
    const transaction = context as EntityManager;
    const outboxEvent = transaction.create(OutboxEvent, {
      id: randomUUID(),
      workflowId,
      eventType: 'payment.requested',
      payload: { ...event },
      occurredAt: new Date(),
      publicationAttempts: 0,
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
