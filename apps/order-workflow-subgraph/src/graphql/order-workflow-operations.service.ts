import type { EntityManager } from '@mikro-orm/core';
import { Inject, Injectable, Scope } from '@nestjs/common';

import { CheckoutService } from '../checkout/checkout.service.ts';
import type { PaymentMethod } from '../checkout/checkout.types.ts';
import {
  CheckoutOperation,
  CheckoutOperationStatus,
} from '../persistence/entities/checkout-operation.entity.ts';
import { OrderWorkflow } from '../persistence/entities/order-workflow.entity.ts';
import { ORDER_WORKFLOW_ENTITY_MANAGER } from '../persistence/persistence.tokens.ts';
import type { OrderWorkflowSessionContext } from './authenticated-subject.decorator.ts';
import type {
  CheckoutInput,
  CheckoutOperationView,
  OrderWorkflowOperations,
  OrderWorkflowOrder,
} from './order-workflow.types.ts';

@Injectable({ scope: Scope.REQUEST })
export class OrderWorkflowOperationsService implements OrderWorkflowOperations {
  constructor(
    @Inject(CheckoutService)
    private readonly checkoutService: CheckoutService,
    @Inject(ORDER_WORKFLOW_ENTITY_MANAGER)
    private readonly entityManager: EntityManager,
  ) {}

  async checkout(
    subject: string,
    input: CheckoutInput,
    session?: OrderWorkflowSessionContext,
  ): Promise<OrderWorkflowOrder> {
    const result = await this.checkoutService.checkout({
      subject,
      ...input,
      session,
    });
    const workflow = await this.entityManager.findOneOrFail(OrderWorkflow, {
      wooOrderId: result.wooOrderId,
    });
    return orderView(result.wooOrderId, input.paymentMethod, workflow);
  }

  async findWorkflow(
    subject: string,
    wooOrderId: string,
  ): Promise<OrderWorkflow | null> {
    const operation = await this.entityManager.findOne(CheckoutOperation, {
      subject,
      wooOrderId,
    });
    return operation
      ? this.entityManager.findOne(OrderWorkflow, {
          checkoutOperationId: operation.id,
        })
      : null;
  }

  async findCheckout(
    subject: string,
    id: string,
  ): Promise<CheckoutOperationView | null> {
    const operation = await this.entityManager.findOne(CheckoutOperation, {
      id,
      subject,
    });
    if (!operation) return null;
    return {
      ...operation,
      status:
        operation.status === CheckoutOperationStatus.PendingWoo ||
        operation.status === CheckoutOperationStatus.CreatingWoo
          ? 'PENDING'
          : operation.status,
    };
  }
}

function orderView(
  wooOrderId: string,
  paymentMethod: PaymentMethod,
  workflow: OrderWorkflow,
): OrderWorkflowOrder {
  if (!/^[1-9]\d*$/.test(wooOrderId)) {
    throw new Error('Woo order id must be a positive decimal integer');
  }
  return {
    __typename: 'Order',
    id: Buffer.from(`post:${wooOrderId}`).toString('base64'),
    wooOrderId,
    paymentMethod,
    workflow: { state: workflow.state },
    pixCode: workflow.pixCode,
  };
}
