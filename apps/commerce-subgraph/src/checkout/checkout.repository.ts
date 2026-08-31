import { randomUUID } from 'node:crypto';

import { LockMode, type EntityManager } from '@mikro-orm/core';

import {
  CheckoutOperation,
  CheckoutOperationStatus,
} from '../persistence/entities/checkout-operation.entity.ts';
import {
  OrderWorkflow,
  OrderWorkflowState,
} from '../persistence/entities/order-workflow.entity.ts';

export interface ClaimCheckoutInput {
  subject: string;
  operationKey: string;
  commandHash: string;
  wooReference: string;
}

export interface ClaimedCheckout {
  operation: CheckoutOperation;
  created: boolean;
}

export type ConfirmCheckout = (
  transaction: unknown,
  workflow: OrderWorkflow,
) => Promise<void>;

export interface CheckoutRepository {
  claim(input: ClaimCheckoutInput): Promise<ClaimedCheckout>;
  confirm(
    operationId: string,
    wooOrderId: string,
    stockItems: readonly { productId: string; quantity: number }[],
    onConfirmed: ConfirmCheckout,
    paymentMethod?: 'PIX' | 'CARD',
  ): Promise<OrderWorkflow>;
}

export class MikroOrmCheckoutRepository implements CheckoutRepository {
  constructor(private readonly entityManager: EntityManager) {}

  async claim(input: ClaimCheckoutInput): Promise<ClaimedCheckout> {
    return this.entityManager.transactional(async (transaction) => {
      const id = randomUUID();
      const rows = (await transaction.getConnection().execute(
        `insert into "commerce_checkout_operation"
          ("id", "subject", "operation_key", "command_hash", "status", "woo_reference", "created_at", "updated_at")
         values (?, ?, ?, ?, ?, ?, current_timestamp, current_timestamp)
         on conflict ("subject", "operation_key") do nothing
         returning "id"`,
        [
          id,
          input.subject,
          input.operationKey,
          input.commandHash,
          CheckoutOperationStatus.PendingWoo,
          input.wooReference,
        ],
      )) as unknown[];
      const created = rows.length > 0;
      const operation = await transaction.findOneOrFail(CheckoutOperation, {
        subject: input.subject,
        operationKey: input.operationKey,
      });
      return { operation, created };
    });
  }

  async confirm(
    operationId: string,
    wooOrderId: string,
    stockItems: readonly { productId: string; quantity: number }[],
    onConfirmed: ConfirmCheckout,
    paymentMethod?: 'PIX' | 'CARD',
  ): Promise<OrderWorkflow> {
    return this.entityManager.transactional(async (transaction) => {
      const operation = await transaction.findOneOrFail(
        CheckoutOperation,
        { id: operationId },
        { lockMode: LockMode.PESSIMISTIC_WRITE },
      );
      const existing = await transaction.findOne(OrderWorkflow, {
        checkoutOperationId: operation.id,
      });
      if (existing) return existing;

      const workflow = transaction.create(OrderWorkflow, {
        id: randomUUID(),
        checkoutOperationId: operation.id,
        wooOrderId,
        stockItems,
        paymentMethod,
        state: OrderWorkflowState.Created,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      transaction.persist(workflow);
      await transaction.flush();
      await onConfirmed(transaction, workflow);
      operation.status = CheckoutOperationStatus.Completed;
      operation.wooOrderId = wooOrderId;
      return workflow;
    });
  }
}
