import { randomUUID } from 'node:crypto';

import type { EntityManager } from '@mikro-orm/core';

import type {
  AppliedSagaTransition,
  OrderWorkflowSnapshot,
  SagaCommand,
} from './order-saga.ts';
import type { TransactionalOrderEventNotifier } from './postgres-order-event.notifier.ts';

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
      'all',
      transaction.getTransactionContext(),
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
      'run',
      transaction.getTransactionContext(),
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
      'run',
      transaction.getTransactionContext(),
    );
  }
}
