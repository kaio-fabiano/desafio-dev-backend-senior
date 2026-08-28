import type { EntityManager } from '@mikro-orm/core';

import type { MarketplaceEvent } from '../messaging/rabbitmq.ts';
import type { OutboxEvent } from '../persistence/entities/outbox-event.entity.ts';

export interface OutboxPublicationRepository {
  claimUnsent(
    transaction: EntityManager,
    limit: number,
  ): Promise<OutboxEvent[]>;
  markPublicationAttempt(
    transaction: EntityManager,
    eventId: string,
    attemptedAt: Date,
  ): Promise<void>;
  markSent(
    transaction: EntityManager,
    eventId: string,
    sentAt: Date,
  ): Promise<void>;
}

export interface OutboxEventPublisher {
  publish(event: MarketplaceEvent): Promise<void>;
}

export class OutboxPublisher {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly outbox: OutboxPublicationRepository,
    private readonly publisher: OutboxEventPublisher,
  ) {}

  async publishBatch(limit = 50): Promise<number> {
    let firstFailure: unknown;
    const published = await this.entityManager.transactional(
      async (transaction) => {
        const events = await this.outbox.claimUnsent(transaction, limit);
        let sent = 0;

        for (const event of events) {
          await this.outbox.markPublicationAttempt(
            transaction,
            event.id,
            new Date(),
          );
          try {
            await this.publisher.publish(this.toMarketplaceEvent(event));
            await this.outbox.markSent(transaction, event.id, new Date());
            sent += 1;
          } catch (error) {
            firstFailure ??= error;
          }
        }
        return sent;
      },
    );

    if (firstFailure) throw firstFailure;
    return published;
  }

  private toMarketplaceEvent(event: OutboxEvent): MarketplaceEvent {
    const operationKey = event.payload.operationKey;
    return {
      correlationId: event.workflowId,
      eventId: event.id,
      eventType: event.eventType,
      occurredAt: event.occurredAt.toISOString(),
      payload: event.payload,
      ...(typeof operationKey === 'string' ? { operationKey } : {}),
    };
  }
}
