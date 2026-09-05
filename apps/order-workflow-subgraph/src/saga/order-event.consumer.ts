import type { EntityManager } from '@mikro-orm/core';

import {
  InboxDisposition,
  type InboxRepository,
} from '../inbox/inbox.repository.ts';
import type { OrderSagaRepository } from './order-saga.repository.ts';
import {
  OrderSaga,
  type AppliedSagaTransition,
  type IgnoredSagaTransition,
  type OrderSagaEvent,
  type StockItem,
} from './order-saga.ts';

export type OrderItemsLoader = (
  transaction: EntityManager,
  workflowId: string,
) => Promise<readonly StockItem[]>;

export type ConsumeResult =
  | { outcome: 'applied'; transition: AppliedSagaTransition }
  | { outcome: 'duplicate' }
  | { outcome: 'ignored'; transition: IgnoredSagaTransition };

export class OrderEventConsumer {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly inbox: InboxRepository,
    private readonly workflows: OrderSagaRepository,
    private readonly loadOrderItems: OrderItemsLoader,
    private readonly saga = new OrderSaga(),
  ) {}

  async consume(event: OrderSagaEvent): Promise<ConsumeResult> {
    const orderId = requiredOrderId(event);
    return this.entityManager.transactional(
      async (transaction): Promise<ConsumeResult> => {
        const claimed = await this.inbox.claim(
          transaction,
          event.eventId,
          event.eventType,
        );
        if (!claimed) return { outcome: 'duplicate' };

        const workflow = await this.workflows.findForUpdate(
          transaction,
          orderId,
        );
        const stockItems =
          event.eventType === 'payment.authorized'
            ? await this.loadOrderItems(transaction, workflow.id)
            : undefined;
        const transition = this.saga.transition(workflow, event, {
          stockItems,
        });
        if (transition.kind === 'ignored') {
          await this.inbox.complete(
            transaction,
            event.eventId,
            workflow.id,
            InboxDisposition.Ignored,
          );
          return { outcome: 'ignored', transition };
        }

        await this.workflows.apply(transaction, workflow, transition);
        await this.inbox.complete(
          transaction,
          event.eventId,
          workflow.id,
          InboxDisposition.Applied,
        );
        return { outcome: 'applied', transition };
      },
    );
  }

  async handle(
    event: OrderSagaEvent,
    acknowledge: () => void | Promise<void>,
  ): Promise<ConsumeResult> {
    const result = await this.consume(event);
    await acknowledge();
    return result;
  }
}

function requiredOrderId(event: OrderSagaEvent): string {
  const orderId = event.payload.orderId;
  if (typeof orderId !== 'string' || !orderId.trim()) {
    throw new TypeError('Saga event orderId must be a non-empty string');
  }
  return orderId;
}
