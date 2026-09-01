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
import { ORDER_TRANSITION_CHANNEL } from '../subscriptions/order-event.channel.ts';

export type OrderItemsLoader = (
  transaction: EntityManager,
  workflowId: string,
) => Promise<readonly StockItem[]>;

export interface OwnedOrderWorkflow extends OrderWorkflowSnapshot {
  operationKey: string;
  subject: string;
}

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

export interface TransactionalOrderEventNotifier {
  notify(transaction: EntityManager, workflowId: string): Promise<void>;
}

export class PostgresTransactionalOrderEventNotifier
  implements TransactionalOrderEventNotifier
{
  notify(transaction: EntityManager, workflowId: string): Promise<void> {
    return transaction
      .getConnection()
      .execute('select pg_notify(?, ?)', [ORDER_TRANSITION_CHANNEL, workflowId])
      .then(() => undefined);
  }
}

export class MikroOrmOrderSagaRepository implements OrderSagaRepository {
  constructor(private readonly notifier: TransactionalOrderEventNotifier) {}

  async findForUpdate(
    transaction: EntityManager,
    wooOrderId: string,
  ): Promise<OwnedOrderWorkflow> {
    const rows = (await transaction.getConnection().execute(
      `select workflow."id", workflow."woo_order_id", workflow."state",
              workflow."payment_id", workflow."pix_code",
              operation."subject", operation."operation_key"
         from "order_workflow_order_workflow" workflow
         join "order_workflow_checkout_operation" operation
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
    workflow: OwnedOrderWorkflow,
    transition: AppliedSagaTransition,
  ): Promise<void> {
    await transaction.getConnection().execute(
      `update "order_workflow_order_workflow"
          set "state" = ?, "payment_id" = ?, "pix_code" = ?,
              "version" = "version" + 1, "updated_at" = current_timestamp
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
    await this.notifier.notify(transaction, workflow.id);
  }

  private async enqueue(
    transaction: EntityManager,
    workflowId: string,
    operationKey: string,
    command: SagaCommand,
  ): Promise<void> {
    await transaction.getConnection().execute(
      `insert into "order_workflow_outbox_event"
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
