import { randomUUID } from 'node:crypto';

import type { EntityManager } from '@mikro-orm/core';

import {
  InboxDisposition,
  type InboxRepository,
} from '../inbox/inbox.repository.ts';
import {
  OrderSaga,
  type AppliedSagaTransition,
  type IgnoredSagaTransition,
  type OrderSagaEvent,
  type OrderWorkflowSnapshot,
  type SagaCommand,
  type StockItem,
} from './order-saga.ts';
import type {
  CommittedTransitionPublisher,
  OwnedOrderWorkflow,
} from '../subscriptions/order-transition.publisher.ts';

export type OrderItemsLoader = (
  wooOrderId: string,
) => Promise<readonly StockItem[]>;

export interface OrderSagaRepository {
  findForUpdate(
    transaction: EntityManager,
    wooOrderId: string,
  ): Promise<OwnedOrderWorkflow>;
  apply(
    transaction: EntityManager,
    workflow: OwnedOrderWorkflow,
    transition: AppliedSagaTransition,
  ): Promise<void>;
}

export class MikroOrmOrderSagaRepository implements OrderSagaRepository {
  async findForUpdate(
    transaction: EntityManager,
    wooOrderId: string,
  ): Promise<OwnedOrderWorkflow> {
    const rows = (await transaction.getConnection().execute(
      `select workflow."id", workflow."woo_order_id", workflow."state",
              workflow."payment_id", workflow."pix_code",
              operation."subject", operation."operation_key"
         from "commerce_order_workflow" workflow
         join "commerce_checkout_operation" operation
           on operation."id" = workflow."checkout_operation_id"
        where workflow."woo_order_id" = ?
        for update`,
      [wooOrderId],
    )) as Array<{
      id: string;
      payment_id?: string;
      pix_code?: string;
      operation_key: string;
      subject: string;
      state: OrderWorkflowSnapshot['state'];
      woo_order_id: string;
    }>;
    const row = rows[0];
    if (!row) throw new Error(`Order workflow ${wooOrderId} was not found`);
    return {
      id: row.id,
      wooOrderId: row.woo_order_id,
      state: row.state,
      paymentId: row.payment_id,
      pixCode: row.pix_code,
      operationKey: row.operation_key,
      subject: row.subject,
    };
  }

  async apply(
    transaction: EntityManager,
    workflow: OrderWorkflowSnapshot,
    transition: AppliedSagaTransition,
  ): Promise<void> {
    await transaction.getConnection().execute(
      `update "commerce_order_workflow"
          set "state" = ?, "payment_id" = ?, "pix_code" = ?, "updated_at" = current_timestamp
        where "id" = ? and "state" = ?`,
      [
        transition.to,
        transition.paymentId ?? workflow.paymentId ?? null,
        transition.pixCode ?? workflow.pixCode ?? null,
        workflow.id,
        workflow.state,
      ],
    );
    if (transition.command) {
      await this.enqueue(
        transaction,
        workflow.id,
        workflow.operationKey,
        transition.command,
      );
    }
  }

  private async enqueue(
    transaction: EntityManager,
    workflowId: string,
    operationKey: string,
    command: SagaCommand,
  ): Promise<void> {
    await transaction.getConnection().execute(
      `insert into "commerce_outbox_event"
        ("id", "workflow_id", "event_type", "payload", "occurred_at")
       values (?, ?, ?, cast(? as jsonb), current_timestamp)`,
      [
        randomUUID(),
        workflowId,
        command.eventType,
        JSON.stringify({ ...command.payload, operationKey }),
      ],
    );
  }
}

export type ConsumeResult =
  | { outcome: 'applied'; transition: AppliedSagaTransition }
  | { outcome: 'duplicate' }
  | { outcome: 'ignored'; transition: IgnoredSagaTransition };

interface CommittedConsumeResult {
  result: ConsumeResult;
  publication?: {
    transition: AppliedSagaTransition;
    workflow: OwnedOrderWorkflow;
  };
}

export class OrderEventConsumer {
  constructor(
    private readonly entityManager: EntityManager,
    private readonly inbox: InboxRepository,
    private readonly workflows: OrderSagaRepository,
    private readonly loadOrderItems: OrderItemsLoader,
    private readonly saga = new OrderSaga(),
    private readonly transitions: CommittedTransitionPublisher = {
      async publish() {
        // Publishing is optional for isolated domain tests.
      },
    },
  ) {}

  async consume(event: OrderSagaEvent): Promise<ConsumeResult> {
    const orderId = requiredOrderId(event);
    const stockItems =
      event.eventType === 'payment.authorized'
        ? await this.loadOrderItems(orderId)
        : undefined;
    const committed = await this.entityManager.transactional(
      async (transaction): Promise<CommittedConsumeResult> => {
        const claimed = await this.inbox.claim(
          transaction,
          event.eventId,
          event.eventType,
        );
        if (!claimed) return { result: { outcome: 'duplicate' } };

        const workflow = await this.workflows.findForUpdate(
          transaction,
          orderId,
        );
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
          return { result: { outcome: 'ignored', transition } };
        }

        await this.workflows.apply(transaction, workflow, transition);
        await this.inbox.complete(
          transaction,
          event.eventId,
          workflow.id,
          InboxDisposition.Applied,
        );
        return {
          result: { outcome: 'applied', transition },
          publication: { transition, workflow },
        };
      },
    );
    if (committed.publication) {
      await this.transitions.publish(
        committed.publication.workflow,
        committed.publication.transition,
      );
    }
    return committed.result;
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
