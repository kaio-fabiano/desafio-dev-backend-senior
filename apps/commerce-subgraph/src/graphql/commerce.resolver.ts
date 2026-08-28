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
import { Inject } from '@nestjs/common';

import type { CheckoutOperation } from '../persistence/entities/checkout-operation.entity.ts';
import { CartService } from '../cart/cart.service.ts';
import { OrderEventsSubscription } from '../subscriptions/order-events.subscription.ts';

type AuthContext = { subject: string };

export type CheckoutInput = {
  operationKey: string;
  paymentMethod: 'PIX' | 'CARD';
};
type OrderReference = { wooOrderId: string };
type CheckoutOperationView = Omit<CheckoutOperation, 'status'> & {
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
};

function authenticatedSubject(context: AuthContext): string {
  if (!context.subject.trim()) throw new Error('Authenticated subject is required');
  return context.subject;
}

export class CommerceResolver<Cart, Order, Workflow> {
  constructor(
    private readonly cart: Pick<CartService, 'addItem' | 'removeItem'>,
    private readonly runCheckout: (
      subject: string,
      input: CheckoutInput,
    ) => Promise<Order>,
    private readonly findWorkflow: (
      wooOrderId: string,
    ) => Promise<Workflow | null>,
    private readonly subscriptions?: OrderEventsSubscription,
    private readonly findCheckout?: (
      id: string,
    ) => Promise<CheckoutOperationView | null>,
  ) {}

  addToCart(context: AuthContext, productId: string, quantity: number) {
    return this.cart.addItem(authenticatedSubject(context), {
      productId: Number(productId),
      quantity,
    }) as Promise<Cart>;
  }

  removeFromCart(context: AuthContext, productId: string, quantity: number) {
    return this.cart.removeItem(authenticatedSubject(context), {
      itemKey: productId,
      quantity,
    }) as Promise<Cart>;
  }

  checkout(context: AuthContext, input: CheckoutInput) {
    return this.runCheckout(authenticatedSubject(context), input);
  }

  workflow(order: OrderReference) {
    return this.findWorkflow(order.wooOrderId);
  }

  checkoutOperation(id: string) {
    return this.findCheckout?.(id) ?? null;
  }

  orderEvents(
    context: AuthContext,
    operationKey: string,
    signal?: AbortSignal,
  ) {
    if (!this.subscriptions) {
      throw new Error('Order event subscriptions are not configured');
    }
    return this.subscriptions.subscribe(authenticatedSubject(context), operationKey, {
      signal,
    });
  }
}

Resolver()(CommerceResolver);
Context()(CommerceResolver.prototype, 'addToCart', 0);
Args('productId')(CommerceResolver.prototype, 'addToCart', 1);
Args('quantity')(CommerceResolver.prototype, 'addToCart', 2);
Mutation('addToCart')(
  CommerceResolver.prototype,
  'addToCart',
  Object.getOwnPropertyDescriptor(CommerceResolver.prototype, 'addToCart')!,
);
Context()(CommerceResolver.prototype, 'removeFromCart', 0);
Args('productId')(CommerceResolver.prototype, 'removeFromCart', 1);
Args('quantity')(CommerceResolver.prototype, 'removeFromCart', 2);
Mutation('removeFromCart')(
  CommerceResolver.prototype,
  'removeFromCart',
  Object.getOwnPropertyDescriptor(
    CommerceResolver.prototype,
    'removeFromCart',
  )!,
);
Context()(CommerceResolver.prototype, 'checkout', 0);
Args('input')(CommerceResolver.prototype, 'checkout', 1);
Mutation('checkout')(
  CommerceResolver.prototype,
  'checkout',
  Object.getOwnPropertyDescriptor(CommerceResolver.prototype, 'checkout')!,
);
Parent()(CommerceResolver.prototype, 'workflow', 0);
ResolveField('workflow')(
  CommerceResolver.prototype,
  'workflow',
  Object.getOwnPropertyDescriptor(CommerceResolver.prototype, 'workflow')!,
);
Args('id')(CommerceResolver.prototype, 'checkoutOperation', 0);
Query('checkout')(
  CommerceResolver.prototype,
  'checkoutOperation',
  Object.getOwnPropertyDescriptor(
    CommerceResolver.prototype,
    'checkoutOperation',
  )!,
);
Context()(CommerceResolver.prototype, 'orderEvents', 0);
Args('operationKey')(CommerceResolver.prototype, 'orderEvents', 1);
Subscription('orderEvents', { resolve: (event: unknown) => event })(
  CommerceResolver.prototype,
  'orderEvents',
  Object.getOwnPropertyDescriptor(CommerceResolver.prototype, 'orderEvents')!,
);

export const COMMERCE_OPERATIONS = Symbol('COMMERCE_OPERATIONS');

export type CommerceOperations<Order, Workflow> = {
  checkout(subject: string, input: CheckoutInput): Promise<Order>;
  findWorkflow(wooOrderId: string): Promise<Workflow | null>;
  findCheckout(id: string): Promise<CheckoutOperationView | null>;
};

/** Discoverable Nest metatype backed by request-scoped runtime operations. */
export class CommerceRuntimeResolver<Cart, Order, Workflow> extends CommerceResolver<
  Cart,
  Order,
  Workflow
> {
  constructor(
    cart: CartService,
    operations: CommerceOperations<Order, Workflow>,
    subscriptions: OrderEventsSubscription,
  ) {
    super(
      cart,
      operations.checkout,
      operations.findWorkflow,
      subscriptions,
      operations.findCheckout,
    );
  }
}

Resolver('Order')(CommerceRuntimeResolver);
Inject(CartService)(CommerceRuntimeResolver, undefined, 0);
Inject(COMMERCE_OPERATIONS)(CommerceRuntimeResolver, undefined, 1);
Inject(OrderEventsSubscription)(CommerceRuntimeResolver, undefined, 2);
