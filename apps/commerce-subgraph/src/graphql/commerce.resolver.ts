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

type AuthContext = {
  subject: string;
  cartToken?: string;
  wooSession?: string;
  cookie?: string;
};

export type CheckoutInput = {
  operationKey: string;
  paymentMethod: 'PIX' | 'CARD';
};
type OrderReference = { wooOrderId: string };
type UserReference = { id: string };
type CheckoutOperationView = Omit<CheckoutOperation, 'status'> & {
  status: 'PENDING' | 'COMPLETED' | 'FAILED';
};

function authenticatedSubject(context: AuthContext): string {
  if (!context.subject.trim())
    throw new Error('Authenticated subject is required');
  return context.subject;
}

export class CommerceResolver<Order, Workflow> {
  constructor(
    private readonly runCheckout: (
      subject: string,
      input: CheckoutInput,
      session?: Omit<AuthContext, 'subject'>,
    ) => Promise<Order>,
    private readonly findWorkflow: (
      wooOrderId: string,
    ) => Promise<Workflow | null>,
    private readonly subscriptions?: OrderEventsSubscription,
    private readonly findCheckout?: (
      subject: string,
      id: string,
    ) => Promise<CheckoutOperationView | null>,
  ) {}

  checkout(context: AuthContext, input: CheckoutInput) {
    return this.runCheckout(authenticatedSubject(context), input, context);
  }

  workflow(order: OrderReference & { workflow?: Workflow }) {
    return order.workflow ?? this.findWorkflow(order.wooOrderId);
  }

  checkoutOperation(id: string, context: AuthContext) {
    return this.findCheckout?.(authenticatedSubject(context), id) ?? null;
  }

  orderEvents(
    context: AuthContext,
    operationKey: string,
    signal?: AbortSignal,
  ) {
    if (!this.subscriptions) {
      throw new Error('Order event subscriptions are not configured');
    }
    return this.subscriptions.subscribe(
      authenticatedSubject(context),
      operationKey,
      {
        signal,
      },
    );
  }
}

Resolver()(CommerceResolver);
Context()(CommerceResolver.prototype, 'checkout', 0);
Args('input')(CommerceResolver.prototype, 'checkout', 1);
Mutation('startCheckout')(
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
Context()(CommerceResolver.prototype, 'checkoutOperation', 1);
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
export const COMMERCE_OPERATIONS = Symbol('COMMERCE_OPERATIONS');

export class CommerceCartResolver {
  constructor(private readonly cart: CartService) {}

  async addToCart(context: AuthContext, productId: string, quantity: number) {
    await this.cart.addItem(authenticatedSubject(context), {
      productId: Number(productId),
      quantity,
    });
    return true;
  }
}

Resolver()(CommerceCartResolver);
Inject(CartService)(CommerceCartResolver, undefined, 0);
Context()(CommerceCartResolver.prototype, 'addToCart', 0);
Args('productId')(CommerceCartResolver.prototype, 'addToCart', 1);
Args('quantity')(CommerceCartResolver.prototype, 'addToCart', 2);
Mutation('commerceAddToCart')(
  CommerceCartResolver.prototype,
  'addToCart',
  Object.getOwnPropertyDescriptor(CommerceCartResolver.prototype, 'addToCart')!,
);

export type CommerceOperations<Order, Workflow> = {
  checkout(
    subject: string,
    input: CheckoutInput,
    session?: Omit<AuthContext, 'subject'>,
  ): Promise<Order>;
  findWorkflow(wooOrderId: string): Promise<Workflow | null>;
  findCheckout(
    subject: string,
    id: string,
  ): Promise<CheckoutOperationView | null>;
  findOrders(
    subject: string,
    first: number,
    offset: number,
  ): Promise<{
    orders: Order[];
    hasNextPage: boolean;
  }>;
};

/** Discoverable Nest metatype backed by request-scoped runtime operations. */
export class CommerceRuntimeResolver<Order, Workflow> extends CommerceResolver<
  Order,
  Workflow
> {
  constructor(operations: CommerceOperations<Order, Workflow>) {
    super(
      operations.checkout,
      operations.findWorkflow,
      undefined,
      operations.findCheckout,
    );
  }
}

Resolver('Order')(CommerceRuntimeResolver);
Inject(COMMERCE_OPERATIONS)(CommerceRuntimeResolver, undefined, 0);

export class CommerceUserResolver<Order> {
  constructor(
    private readonly operations: Pick<
      CommerceOperations<Order, unknown>,
      'findOrders'
    >,
  ) {}

  async orders(
    user: UserReference,
    context: AuthContext,
    first = 20,
    after?: string,
  ) {
    const subject = authenticatedSubject(context);
    if (user.id !== subject) throw new Error('User orders are private');
    if (!Number.isSafeInteger(first) || first < 1 || first > 100) {
      throw new Error('Order page size must be between 1 and 100');
    }
    const offset = decodeOffset(after);
    const page = await this.operations.findOrders(subject, first, offset);
    return {
      edges: page.orders.map((node) => ({ node })),
      pageInfo: {
        hasNextPage: page.hasNextPage,
        endCursor: page.orders.length
          ? Buffer.from(String(offset + page.orders.length)).toString(
              'base64url',
            )
          : null,
      },
    };
  }
}

function decodeOffset(cursor?: string): number {
  if (!cursor) return 0;
  const offset = Number(Buffer.from(cursor, 'base64url').toString());
  if (!Number.isSafeInteger(offset) || offset < 0) {
    throw new Error('Order cursor is invalid');
  }
  return offset;
}

Resolver('User')(CommerceUserResolver);
Inject(COMMERCE_OPERATIONS)(CommerceUserResolver, undefined, 0);
Parent()(CommerceUserResolver.prototype, 'orders', 0);
Context()(CommerceUserResolver.prototype, 'orders', 1);
Args('first')(CommerceUserResolver.prototype, 'orders', 2);
Args('after')(CommerceUserResolver.prototype, 'orders', 3);
ResolveField('orders')(
  CommerceUserResolver.prototype,
  'orders',
  Object.getOwnPropertyDescriptor(CommerceUserResolver.prototype, 'orders')!,
);

/** Singleton resolver so a subscription outlives the request that opens it. */
export class CommerceSubscriptionResolver {
  constructor(private readonly subscriptions: OrderEventsSubscription) {}

  orderEvents(context: AuthContext, operationKey: string) {
    return this.subscriptions.subscribe(
      authenticatedSubject(context),
      operationKey,
    );
  }
}

Resolver()(CommerceSubscriptionResolver);
Inject(OrderEventsSubscription)(CommerceSubscriptionResolver, undefined, 0);
Context()(CommerceSubscriptionResolver.prototype, 'orderEvents', 0);
Args('operationKey')(CommerceSubscriptionResolver.prototype, 'orderEvents', 1);
Subscription('orderEvents', { resolve: (event: unknown) => event })(
  CommerceSubscriptionResolver.prototype,
  'orderEvents',
  Object.getOwnPropertyDescriptor(
    CommerceSubscriptionResolver.prototype,
    'orderEvents',
  )!,
);
