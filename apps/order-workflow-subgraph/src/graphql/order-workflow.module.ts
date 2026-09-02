import { resolve } from 'node:path';

import { MikroORM, type EntityManager } from '@mikro-orm/core';
import {
  ApolloFederationDriver,
  type ApolloFederationDriverConfig,
} from '@nestjs/apollo';
import { Module, Scope } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';

import {
  MikroOrmCheckoutRepository,
  type CheckoutRepository,
} from '../checkout/checkout.repository.ts';
import { CheckoutService } from '../checkout/checkout.service.ts';
import { createWooCheckoutAdapter } from '../checkout/woo-checkout.adapter.ts';
import type { WooCheckoutPort } from '../checkout/woo-checkout.port.ts';
import { OrderWorkflowRuntimeLifecycle } from '../messaging/order-workflow-messaging.runtime.ts';
import {
  MikroOrmOutboxRepository,
  type OutboxRepository,
} from '../outbox/outbox.repository.ts';
import mikroOrmConfig from '../persistence/mikro-orm.config.ts';
import { MikroOrmOrderEventReplay } from '../subscriptions/mikro-orm-order-event.replay.ts';
import { OrderEventBroker } from '../subscriptions/order-event-broker.ts';
import { OrderEventsSubscription } from '../subscriptions/order-events.subscription.ts';
import { PostgresOrderEventRelay } from '../subscriptions/postgres-order-event.relay.ts';
import { FederationAuthGuard } from './federation-auth.guard.ts';
import { OrderWorkflowOperationsService } from './order-workflow-operations.service.ts';
import {
  ORDER_WORKFLOW_OPERATIONS,
  OrderWorkflowRuntimeResolver,
  OrderWorkflowSubscriptionResolver,
} from './order-workflow.resolver.ts';
import {
  CHECKOUT_REPOSITORY,
  ORDER_WORKFLOW_ENTITY_MANAGER,
  ORDER_WORKFLOW_ORM,
  OUTBOX_REPOSITORY,
  WOO_CHECKOUT,
} from './order-workflow.tokens.ts';
import { SubjectOwnerGuard } from './subject-owner.guard.ts';

export {
  ORDER_WORKFLOW_ENTITY_MANAGER,
  ORDER_WORKFLOW_ORM
} from './order-workflow.tokens.ts';

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value?.trim()) throw new Error(`${name} is required`);
  return value;
}

export function orderWorkflowRequestContext({
  req,
}: {
  req: { headers: Record<string, string | string[] | undefined> };
}) {
  const rawSubject = req.headers['x-authenticated-subject'];
  return {
    req,
    subject: (Array.isArray(rawSubject) ? rawSubject[0] : rawSubject) ?? '',
    cartToken: String(req.headers['cart-token'] ?? ''),
    wooSession: String(req.headers['woocommerce-session'] ?? ''),
    cookie: String(req.headers.cookie ?? ''),
  };
}

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      typePaths: [
        resolve('libs/contracts/graphql/order-workflow/schema.graphql'),
      ],
      context: orderWorkflowRequestContext,
      fieldResolverEnhancers: ['guards'],
    }),
  ],
  providers: [
    {
      provide: ORDER_WORKFLOW_ORM,
      useFactory: () => MikroORM.init(mikroOrmConfig),
    },
    {
      provide: ORDER_WORKFLOW_ENTITY_MANAGER,
      scope: Scope.REQUEST,
      inject: [ORDER_WORKFLOW_ORM],
      useFactory: (orm: MikroORM) => orm.em.fork(),
    },
    {
      provide: WOO_CHECKOUT,
      useFactory: () =>
        createWooCheckoutAdapter(requiredEnvironment('WORDPRESS_URL'), {
          consumerKey: requiredEnvironment('WOO_CONSUMER_KEY'),
          consumerSecret: requiredEnvironment('WOO_CONSUMER_SECRET'),
        }),
    },
    {
      provide: CHECKOUT_REPOSITORY,
      scope: Scope.REQUEST,
      inject: [ORDER_WORKFLOW_ENTITY_MANAGER],
      useFactory: (entityManager: EntityManager) =>
        new MikroOrmCheckoutRepository(entityManager),
    },
    { provide: OUTBOX_REPOSITORY, useClass: MikroOrmOutboxRepository },
    {
      provide: CheckoutService,
      scope: Scope.REQUEST,
      inject: [CHECKOUT_REPOSITORY, OUTBOX_REPOSITORY, WOO_CHECKOUT],
      useFactory: (
        checkouts: CheckoutRepository,
        outbox: OutboxRepository,
        wooCheckout: WooCheckoutPort,
      ) => new CheckoutService(checkouts, outbox, wooCheckout),
    },
    OrderWorkflowOperationsService,
    {
      provide: ORDER_WORKFLOW_OPERATIONS,
      useExisting: OrderWorkflowOperationsService,
    },
    {
      provide: OrderWorkflowRuntimeResolver,
      useClass: OrderWorkflowRuntimeResolver,
      scope: Scope.REQUEST,
    },
    OrderWorkflowSubscriptionResolver,
    OrderWorkflowRuntimeLifecycle,
    OrderEventBroker,
    SubjectOwnerGuard,
    FederationAuthGuard,
    { provide: APP_GUARD, useExisting: FederationAuthGuard },
    {
      provide: PostgresOrderEventRelay,
      inject: [OrderEventBroker, ORDER_WORKFLOW_ORM],
      useFactory: (broker: OrderEventBroker, orm: MikroORM) =>
        new PostgresOrderEventRelay(broker, new MikroOrmOrderEventReplay(orm)),
    },
    {
      provide: OrderEventsSubscription,
      inject: [OrderEventBroker, ORDER_WORKFLOW_ORM],
      useFactory: (broker: OrderEventBroker, orm: MikroORM) =>
        new OrderEventsSubscription(broker, new MikroOrmOrderEventReplay(orm)),
    },
  ],
  exports: [
    ORDER_WORKFLOW_ORM,
    OrderEventBroker,
    OrderEventsSubscription,
    PostgresOrderEventRelay,
    OrderWorkflowRuntimeLifecycle,
  ],
})
export class OrderWorkflowModule {}
