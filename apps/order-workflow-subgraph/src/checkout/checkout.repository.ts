import { randomUUID } from 'node:crypto';

import { LockMode, raw, type EntityManager } from '@mikro-orm/core';

import {
  CheckoutOperation,
  CheckoutOperationStatus,
} from '../persistence/entities/checkout-operation.entity.ts';
import {
  OrderWorkflow,
  OrderWorkflowState,
} from '../persistence/entities/order-workflow.entity.ts';
import type { PaymentMethod } from './checkout.types.ts';

export interface ClaimCheckoutInput {
  subject: string;
  operationKey: string;
  commandHash: string;
  wooReference: string;
}

export interface ClaimedCheckout {
  operation: CheckoutOperation;
  ownerToken: string | null;
}

export type ConfirmCheckout = (
  transaction: unknown,
  workflow: OrderWorkflow,
) => Promise<void>;

export interface CheckoutRepository {
  claim(input: ClaimCheckoutInput): Promise<ClaimedCheckout>;
  beginCreation(operationId: string, ownerToken: string): Promise<void>;
  release(operationId: string, ownerToken: string): Promise<void>;
  confirm(
    operationId: string,
    wooOrderId: string,
    stockItems: readonly { productId: string; quantity: number }[],
    onConfirmed: ConfirmCheckout,
    paymentMethod: PaymentMethod,
    ownerToken: string,
  ): Promise<OrderWorkflow>;
}

export class MikroOrmCheckoutRepository implements CheckoutRepository {
  constructor(private readonly entityManager: EntityManager) {}

  async claim(input: ClaimCheckoutInput): Promise<ClaimedCheckout> {
    return this.entityManager.transactional(
      async (transaction) => {
        const id = randomUUID();
        const ownerToken = randomUUID();
        //TODO: trocar peplo KYSELY em todo lugar query builder muito melhor
        const rows = (await transaction.getConnection().execute(
          `insert into "order_workflow_checkout_operation"
            ("id", "subject", "operation_key", "command_hash", "status", "woo_reference", "owner_token", "lease_until", "created_at", "updated_at")
           values (?, ?, ?, ?, ?, ?, ?, current_timestamp + interval '30 seconds', current_timestamp, current_timestamp)
           on conflict ("operation_key") do update
             set "owner_token" = excluded."owner_token",
                 "lease_until" = excluded."lease_until",
                 "updated_at" = current_timestamp
           where "order_workflow_checkout_operation"."woo_order_id" is null
             and coalesce("order_workflow_checkout_operation"."lease_until", '-infinity') < current_timestamp
           returning "id"`,
          [
            id,
            input.subject,
            input.operationKey,
            input.commandHash,
            CheckoutOperationStatus.PendingWoo,
            input.wooReference,
            ownerToken,
          ],
          'all',
          transaction.getTransactionContext(),
        )) as unknown[];
        const operation = await transaction.findOneOrFail(CheckoutOperation, {
          operationKey: input.operationKey,
        });
        return { operation, ownerToken: rows.length > 0 ? ownerToken : null };
      },
      { clear: true },
    );
  }

  async beginCreation(operationId: string, ownerToken: string): Promise<void> {
    const changed = await this.entityManager.nativeUpdate(
      CheckoutOperation,
      {
        id: operationId,
        ownerToken,
        status: CheckoutOperationStatus.PendingWoo,
        [raw('lease_until > current_timestamp')]: [],
      },
      { status: CheckoutOperationStatus.CreatingWoo, updatedAt: new Date() },
    );
    if (changed !== 1) throw new Error('Checkout creation lease was lost');
  }

  async release(operationId: string, ownerToken: string): Promise<void> {
    await this.entityManager.nativeUpdate(
      CheckoutOperation,
      { id: operationId, ownerToken },
      { leaseUntil: new Date(), updatedAt: new Date() },
    );
  }

  async confirm(
    operationId: string,
    wooOrderId: string,
    stockItems: readonly { productId: string; quantity: number }[],
    onConfirmed: ConfirmCheckout,
    paymentMethod: PaymentMethod,
    ownerToken: string,
  ): Promise<OrderWorkflow> {
    return this.entityManager.transactional(
      async (transaction) => {
        const operation = await transaction.findOne(
          CheckoutOperation,
          {
            id: operationId,
            ownerToken,
            status: CheckoutOperationStatus.CreatingWoo,
            [raw((alias) => `${alias}.lease_until > current_timestamp`)]: [],
          },
          { lockMode: LockMode.PESSIMISTIC_WRITE },
        );
        if (!operation) throw new Error('Checkout creation lease was lost');

        const workflow = transaction.create(OrderWorkflow, {
          id: randomUUID(),
          checkoutOperationId: operation.id,
          wooOrderId,
          stockItems: [...stockItems],
          paymentMethod,
          state: OrderWorkflowState.Created,
          version: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        transaction.persist(workflow);
        await transaction.flush();
        await onConfirmed(transaction, workflow);
        operation.status = CheckoutOperationStatus.Completed;
        operation.wooOrderId = wooOrderId;
        operation.ownerToken = undefined;
        operation.leaseUntil = undefined;
        return workflow;
      },
      { clear: true },
    );
  }
}
