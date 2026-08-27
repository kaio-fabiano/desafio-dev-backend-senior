import { randomUUID } from 'node:crypto';

import type { EntityManager } from '@mikro-orm/core';

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
}
