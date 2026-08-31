import { randomBytes, randomUUID } from 'node:crypto';

import type {
  MarketplaceEvent,
  OrderWorkflowTransitionedEvent,
} from '../messaging/rabbitmq.ts';
import type {
  AppliedSagaTransition,
  OrderWorkflowSnapshot,
} from '../saga/order-saga.ts';

export interface OwnedOrderWorkflow extends OrderWorkflowSnapshot {
  operationKey: string;
  subject: string;
}

export interface TransitionEventPublisher {
  publish(event: MarketplaceEvent): Promise<void>;
}

export interface CommittedTransitionPublisher {
  publish(
    workflow: OwnedOrderWorkflow,
    transition: AppliedSagaTransition,
  ): Promise<void>;
}

export class OrderTransitionPublisher implements CommittedTransitionPublisher {
  constructor(
    private readonly publisher: TransitionEventPublisher,
    private readonly now: () => Date = () => new Date(),
    private readonly eventId: () => string = randomUUID,
    private readonly traceId: () => string = () => randomBytes(16).toString('hex'),
  ) {}

  async publish(
    workflow: OwnedOrderWorkflow,
    transition: AppliedSagaTransition,
  ): Promise<void> {
    for (const state of transition.states) {
      const occurredAt = this.now().toISOString();
      const event: OrderWorkflowTransitionedEvent = {
        correlationId: workflow.id,
        eventId: this.eventId(),
        eventType: 'order.workflow-transitioned',
        eventVersion: 'v1',
        occurredAt,
        operationKey: workflow.operationKey,
        subject: workflow.subject,
        traceContext: { traceId: this.traceId() },
        payload: {
          eventTime: occurredAt,
          operationKey: workflow.operationKey,
          orderId: workflow.wooOrderId,
          state,
          ...(transition.pixCode && state === transition.to
            ? { pixCode: transition.pixCode }
            : {}),
        },
      };
      await this.publisher.publish(event);
    }
  }
}
