import { Inject } from '@nestjs/common';
import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
  Subscription,
} from '@nestjs/graphql';

import {
  OAuthSubject,
  RequireScopes,
} from '@desafio-dev-backend-senior/source/platform-nest';
import type { CheckoutOperation } from '../persistence/entities/checkout-operation.entity.ts';
import { OrderEventsSubscription } from '../subscriptions/order-events.subscription.ts';
import {
  OrderWorkflowSession,
  type OrderWorkflowSessionContext,
} from './authenticated-subject.decorator.ts';

export type CheckoutInput = {
  operationKey: string;
  paymentMethod: 'PIX' | 'CARD';
};
type OrderReference = { wooOrderId: string };
export type CheckoutOperationView = Omit<CheckoutOperation, 'status'> & {
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
};

@Resolver()
export class OrderWorkflowResolver<Order, Workflow> {
  constructor(
    private readonly runCheckout: (
      subject: string,
      input: CheckoutInput,
      session?: OrderWorkflowSessionContext,
    ) => Promise<Order>,
    private readonly findWorkflow: (
      subject: string,
      wooOrderId: string,
    ) => Promise<Workflow | null>,
    private readonly subscriptions?: OrderEventsSubscription,
    private readonly findCheckout?: (
      subject: string,
      id: string,
    ) => Promise<CheckoutOperationView | null>,
  ) {}

  @Mutation('startCheckout')
  @RequireScopes('cart:write')
  checkout(
    @OAuthSubject() subject: string,
    @Args('input') input: CheckoutInput,
    @OrderWorkflowSession() session: OrderWorkflowSessionContext,
  ) {
    return this.runCheckout(subject, input, session);
  }

  @ResolveField('workflow')
  @RequireScopes('orders:read')
  workflow(
    @Parent() order: OrderReference & { workflow?: Workflow },
    @OAuthSubject() subject: string,
  ) {
    return order.workflow ?? this.findWorkflow(subject, order.wooOrderId);
  }

  @Query('checkout')
  @RequireScopes('orders:read')
  checkoutOperation(
    @Args('id') id: string,
    @OAuthSubject() subject: string,
  ) {
    return this.findCheckout?.(subject, id) ?? null;
  }

  orderEvents(subject: string, operationKey: string, signal?: AbortSignal) {
    if (!this.subscriptions) {
      throw new Error('Order event subscriptions are not configured');
    }
    return this.subscriptions.subscribe(subject, operationKey, { signal });
  }
}

export const ORDER_WORKFLOW_OPERATIONS = Symbol('ORDER_WORKFLOW_OPERATIONS');

export type OrderWorkflowOperations<Order, Workflow> = {
  checkout(
    subject: string,
    input: CheckoutInput,
    session?: OrderWorkflowSessionContext,
  ): Promise<Order>;
  findWorkflow(subject: string, wooOrderId: string): Promise<Workflow | null>;
  findCheckout(
    subject: string,
    id: string,
  ): Promise<CheckoutOperationView | null>;
};

@Resolver('Order')
export class OrderWorkflowRuntimeResolver<
  Order,
  Workflow,
> extends OrderWorkflowResolver<Order, Workflow> {
  constructor(
    @Inject(ORDER_WORKFLOW_OPERATIONS)
    operations: OrderWorkflowOperations<Order, Workflow>,
  ) {
    super(
      operations.checkout.bind(operations),
      operations.findWorkflow.bind(operations),
      undefined,
      operations.findCheckout.bind(operations),
    );
  }
}

@Resolver()
export class OrderWorkflowSubscriptionResolver {
  constructor(
    @Inject(OrderEventsSubscription)
    private readonly subscriptions: OrderEventsSubscription,
  ) {}

  @Subscription('orderEvents', { resolve: (event: unknown) => event })
  @RequireScopes('orders:read')
  orderEvents(
    @OAuthSubject() subject: string,
    @Args('operationKey') operationKey: string,
  ) {
    return this.subscriptions.subscribe(subject, operationKey);
  }
}
