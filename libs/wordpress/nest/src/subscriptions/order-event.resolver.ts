import { Inject, UseGuards } from '@nestjs/common';
import {
  Args,
  Context,
  Field,
  ID,
  ObjectType,
  Query,
  Resolver,
  Subscription,
} from '@nestjs/graphql';

import { OrderEventService, type OrderEvent } from './order-event.service.ts';
import {
  SubscriptionAuthGuard,
  type SubscriptionContext,
} from './subscription-auth.guard.ts';

class OrderEventGraphqlType implements OrderEvent {
  operationKey!: string;
  orderId!: string;
  state!: string;
  pixCode?: string;
  eventTime!: string;
}

ObjectType('OrderEvent')(OrderEventGraphqlType);
Field(() => ID)(OrderEventGraphqlType.prototype, 'operationKey');
Field(() => ID)(OrderEventGraphqlType.prototype, 'orderId');
Field(() => String)(OrderEventGraphqlType.prototype, 'state');
Field(() => String, { nullable: true })(
  OrderEventGraphqlType.prototype,
  'pixCode',
);
Field(() => String)(OrderEventGraphqlType.prototype, 'eventTime');

export class OrderEventResolver {
  constructor(private readonly events: OrderEventService) {}

  subscriptionServiceReady(): boolean {
    return true;
  }

  orderEvents(
    context: SubscriptionContext,
    operationKey: string,
  ): AsyncIterableIterator<OrderEvent> {
    return this.events.subscribe(context.subject, operationKey);
  }
}

Inject(OrderEventService)(OrderEventResolver, undefined, 0);
Resolver()(OrderEventResolver);
Reflect.defineMetadata(
  'design:paramtypes',
  [Object, String],
  OrderEventResolver.prototype,
  'orderEvents',
);
Query(() => Boolean, { name: 'subscriptionServiceReady' })(
  OrderEventResolver.prototype,
  'subscriptionServiceReady',
  Object.getOwnPropertyDescriptor(
    OrderEventResolver.prototype,
    'subscriptionServiceReady',
  ) as PropertyDescriptor,
);
Context()(OrderEventResolver.prototype, 'orderEvents', 0);
Args('operationKey', { type: () => ID })(
  OrderEventResolver.prototype,
  'orderEvents',
  1,
);
UseGuards(SubscriptionAuthGuard)(
  OrderEventResolver.prototype,
  'orderEvents',
  Object.getOwnPropertyDescriptor(
    OrderEventResolver.prototype,
    'orderEvents',
  ) as PropertyDescriptor,
);
Subscription(() => OrderEventGraphqlType, {
  name: 'orderEvents',
  resolve: (event: OrderEvent) => event,
})(
  OrderEventResolver.prototype,
  'orderEvents',
  Object.getOwnPropertyDescriptor(
    OrderEventResolver.prototype,
    'orderEvents',
  ) as PropertyDescriptor,
);
