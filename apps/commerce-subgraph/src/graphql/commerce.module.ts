import { timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';

import { MikroORM, type EntityManager } from '@mikro-orm/core';
import {
  ApolloFederationDriver,
  type ApolloFederationDriverConfig,
} from '@nestjs/apollo';
import { Module, Scope, type OnApplicationShutdown } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';

import { CartService } from '../cart/cart.service.ts';
import { createWooCartAdapter } from '../cart/woo-cart.adapter.ts';
import { MikroOrmCheckoutRepository } from '../checkout/checkout.repository.ts';
import { CheckoutService } from '../checkout/checkout.service.ts';
import { createWooOrderAdapter } from '../checkout/woo-order.adapter.ts';
import { MikroOrmOutboxRepository } from '../outbox/outbox.repository.ts';
import { CheckoutOperation } from '../persistence/entities/checkout-operation.entity.ts';
import { OrderWorkflow } from '../persistence/entities/order-workflow.entity.ts';
import mikroOrmConfig from '../persistence/mikro-orm.config.ts';
import { OrderEventBroker } from '../subscriptions/order-event-broker.ts';
import { OrderEventsSubscription } from '../subscriptions/order-events.subscription.ts';
import {
  COMMERCE_OPERATIONS,
  CommerceCartResolver,
  CommerceRuntimeResolver,
  CommerceSubscriptionResolver,
  CommerceUserResolver,
  type CheckoutInput,
} from './commerce.resolver.ts';

export const COMMERCE_ORM = Symbol('COMMERCE_ORM');
export const COMMERCE_ENTITY_MANAGER = Symbol('COMMERCE_ENTITY_MANAGER');
export const WOO_CART = Symbol('WOO_CART');

export function wooOrderGraphqlId(wooOrderId: string): string {
  if (!/^[1-9]\d*$/.test(wooOrderId)) {
    throw new Error('Woo order id must be a positive decimal integer');
  }
  return Buffer.from(`post:${wooOrderId}`).toString('base64');
}

export class CommercePersistenceLifecycle implements OnApplicationShutdown {
  constructor(private readonly orm: MikroORM) {}

  onApplicationShutdown(): Promise<void> {
    return this.orm.close(true);
  }
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`${name} is required`);
  return value;
}

export function commerceRequestContext({
  req,
}: {
  req: { headers: Record<string, string | string[] | undefined> };
}) {
  const receivedSecret = String(req.headers['x-federation-secret'] ?? '');
  const expectedSecret = requiredEnvironment('FEDERATION_INTERNAL_SECRET');
  const trusted =
    receivedSecret.length === expectedSecret.length &&
    timingSafeEqual(Buffer.from(receivedSecret), Buffer.from(expectedSecret));
  if (!trusted) throw new Error('Untrusted federation request');
  const rawSubject = req.headers['x-authenticated-subject'];
  const subject =
    (Array.isArray(rawSubject) ? rawSubject[0] : rawSubject) ?? '';
  return {
    subject,
    cartToken: String(req.headers['cart-token'] ?? ''),
    wooSession: String(req.headers['woocommerce-session'] ?? ''),
    cookie: String(req.headers.cookie ?? ''),
    scopes: [],
    audience: [],
    requestId: String(req.headers['x-request-id'] ?? ''),
  };
}

export class CommerceModule {}

Module({
  imports: [
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      typePaths: [resolve('libs/contracts/graphql/commerce/schema.graphql')],
      context: commerceRequestContext,
    }),
  ],
  providers: [
    { provide: COMMERCE_ORM, useFactory: () => MikroORM.init(mikroOrmConfig) },
    {
      provide: COMMERCE_ENTITY_MANAGER,
      scope: Scope.REQUEST,
      inject: [COMMERCE_ORM],
      useFactory: (orm: MikroORM) => orm.em.fork(),
    },
    CommerceSubscriptionResolver,
    CommerceCartResolver,
    {
      provide: WOO_CART,
      useFactory: () =>
        createWooCartAdapter(requiredEnvironment('WORDPRESS_URL')),
    },
    {
      provide: CartService,
      inject: [WOO_CART],
      useFactory: (cart: ReturnType<typeof createWooCartAdapter>) =>
        new CartService(cart),
    },
    OrderEventBroker,
    {
      provide: OrderEventsSubscription,
      inject: [OrderEventBroker],
      useFactory: (broker: OrderEventBroker) =>
        new OrderEventsSubscription(broker),
    },
    {
      provide: COMMERCE_OPERATIONS,
      scope: Scope.REQUEST,
      inject: [CartService, COMMERCE_ENTITY_MANAGER],
      useFactory: (cart: CartService, entityManager: EntityManager) => {
        const checkout = new CheckoutService(
          new MikroOrmCheckoutRepository(entityManager),
          new MikroOrmOutboxRepository(),
          createWooOrderAdapter({
            endpoint: requiredEnvironment('WORDPRESS_URL'),
            consumerKey: requiredEnvironment('WOO_CONSUMER_KEY'),
            consumerSecret: requiredEnvironment('WOO_CONSUMER_SECRET'),
          }),
        );
        return {
          checkout: async (
            subject: string,
            input: CheckoutInput,
            session?: {
              cartToken?: string;
              wooSession?: string;
              cookie?: string;
            },
          ) => {
            const result = await checkout.checkout({
              subject,
              ...input,
              cartSnapshot: await cart.get(subject, session),
            });
            const workflow = await entityManager.findOneOrFail(OrderWorkflow, {
              wooOrderId: result.wooOrderId,
            });
            return {
              __typename: 'Order',
              id: wooOrderGraphqlId(result.wooOrderId),
              wooOrderId: result.wooOrderId,
              paymentMethod: input.paymentMethod,
              workflow: { state: workflow.state },
              pixCode: workflow.pixCode,
            };
          },
          findWorkflow: (wooOrderId: string) =>
            entityManager.findOne(OrderWorkflow, { wooOrderId }),
          findCheckout: async (subject: string, id: string) => {
            const operation = await entityManager.findOne(CheckoutOperation, {
              id,
              subject,
            });
            return (
              operation && {
                ...operation,
                status:
                  operation.status === 'PENDING_WOO'
                    ? 'PENDING'
                    : operation.status,
              }
            );
          },
          findOrders: async (
            subject: string,
            first: number,
            offset: number,
          ) => {
            const operations = await entityManager.find(
              CheckoutOperation,
              { subject, wooOrderId: { $ne: null } },
              {
                orderBy: { createdAt: 'desc', id: 'desc' },
                limit: first + 1,
                offset,
              },
            );
            const page = operations.slice(0, first);
            const workflows = page.length
              ? await entityManager.find(OrderWorkflow, {
                  checkoutOperationId: { $in: page.map(({ id }) => id) },
                })
              : [];
            const byCheckout = new Map(
              workflows.map((workflow) => [
                workflow.checkoutOperationId,
                workflow,
              ]),
            );
            return {
              orders: page.map((operation) => {
                const workflow = byCheckout.get(operation.id);
                if (!workflow || !operation.wooOrderId) {
                  throw new Error('Completed checkout is missing its workflow');
                }
                if (!workflow.paymentMethod) {
                  throw new Error(
                    'Completed checkout is missing its payment method',
                  );
                }
                return {
                  __typename: 'Order',
                  id: wooOrderGraphqlId(operation.wooOrderId),
                  wooOrderId: operation.wooOrderId,
                  paymentMethod: workflow.paymentMethod,
                  workflow: { state: workflow.state },
                  pixCode: workflow.pixCode,
                };
              }),
              hasNextPage: operations.length > first,
            };
          },
        };
      },
    },
    {
      provide: CommerceRuntimeResolver,
      useClass: CommerceRuntimeResolver,
      scope: Scope.REQUEST,
    },
    {
      provide: CommerceUserResolver,
      useClass: CommerceUserResolver,
      scope: Scope.REQUEST,
    },
    {
      provide: CommercePersistenceLifecycle,
      inject: [COMMERCE_ORM],
      useFactory: (orm: MikroORM) => new CommercePersistenceLifecycle(orm),
    },
  ],
  exports: [OrderEventBroker, OrderEventsSubscription],
})(CommerceModule);
