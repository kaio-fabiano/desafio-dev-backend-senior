import { Inject } from '@nestjs/common';
import {
  Args,
  Context,
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
import { OrderEventsSubscription } from '../order-events/order-events.subscription.ts';
import type { OrderWorkflow } from '../persistence/entities/order-workflow.entity.ts';
import {
  OrderWorkflowSession,
  type OrderWorkflowSessionContext,
} from './authenticated-subject.decorator.ts';
import { ORDER_WORKFLOW_OPERATIONS } from './order-workflow-operations.token.ts';
import type {
  CheckoutInput,
  CheckoutOperationView,
  OrderWorkflowOperations,
  OrderWorkflowOrder,
} from './order-workflow.types.ts';

type OrderReference = {
  wooOrderId: string;
  workflow?: OrderWorkflow;
};

@Resolver('Order')
export class OrderWorkflowResolver {
  constructor(
    @Inject(ORDER_WORKFLOW_OPERATIONS)
    private readonly operations: OrderWorkflowOperations,
  ) {}

  @Mutation('startCheckout')
  @RequireScopes('cart:write')
  checkout(
    @OAuthSubject() subject: string,
    @Args('input') input: CheckoutInput,
    @OrderWorkflowSession() session: OrderWorkflowSessionContext,
  ): Promise<OrderWorkflowOrder> {
    return this.operations.checkout(subject, input, session);
  }

  @ResolveField('workflow')
  @RequireScopes('orders:read')
  workflow(
    @Parent() order: OrderReference,
    @OAuthSubject() subject: string,
  ): OrderWorkflow | Promise<OrderWorkflow | null> {
    return (
      order.workflow ?? this.operations.findWorkflow(subject, order.wooOrderId)
    );
  }

  @Query('checkout')
  @RequireScopes('orders:read')
  checkoutOperation(
    @Args('id') id: string,
    @OAuthSubject() subject: string,
  ): Promise<CheckoutOperationView | null> {
    return this.operations.findCheckout(subject, id);
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
    @Context('signal') signal: AbortSignal,
  ) {
    return this.subscriptions.subscribe(subject, operationKey, { signal });
  }
}

export { ORDER_WORKFLOW_OPERATIONS } from './order-workflow-operations.token.ts';
export type {
  CheckoutInput,
  CheckoutOperationView,
  OrderWorkflowOperations
} from './order-workflow.types.ts';
