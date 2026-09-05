import { resolve } from 'node:path';

import {
  GraphqlOAuthResourceGuard,
  OAuthResourceModule,
} from '@desafio-dev-backend-senior/source/platform-nest';
import {
  ApolloFederationDriver,
  type ApolloFederationDriverConfig,
} from '@nestjs/apollo';
import type { MiddlewareConsumer, NestModule } from '@nestjs/common';
import { Module, RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';

import { CheckoutModule } from '../checkout/checkout.module.ts';
import { OrderEventsModule } from '../order-events/order-events.module.ts';
import { PersistenceModule } from '../persistence/persistence.module.ts';
import {
  OrderWorkflowSseConnections,
  OrderWorkflowSseMiddleware,
} from './sse/sse.middleware.ts';
import { OrderWorkflowOperationsService } from './order-workflow-operations.service.ts';
import {
  OrderWorkflowResolver,
  OrderWorkflowSubscriptionResolver,
} from './order-workflow.resolver.ts';
import { ORDER_WORKFLOW_OPERATIONS } from './order-workflow-operations.token.ts';

export function orderWorkflowRequestContext({
  req,
}: {
  req: { headers: Record<string, string | string[] | undefined> };
}) {
  return {
    req,
    cartToken: String(req.headers['cart-token'] ?? ''),
    wooSession: String(req.headers['woocommerce-session'] ?? ''),
    cookie: String(req.headers.cookie ?? ''),
  };
}

@Module({
  imports: [
    PersistenceModule,
    CheckoutModule,
    OrderEventsModule,
    OAuthResourceModule.register({
      audience:
        process.env.ORDER_WORKFLOW_OAUTH_AUDIENCE ??
        'https://order-workflow.marketplace.local',
      issuer:
        process.env.OAUTH_ISSUER ?? 'http://identity-subgraph:3001/api/auth',
      jwksUrl:
        process.env.IDENTITY_JWKS_URL ??
        'http://identity-subgraph:3001/api/auth/jwks',
    }),
    GraphQLModule.forRoot<ApolloFederationDriverConfig>({
      driver: ApolloFederationDriver,
      typePaths: [
        resolve('libs/contracts/graphql/order-workflow/schema.graphql'),
      ],
      context: orderWorkflowRequestContext,
      fieldResolverEnhancers: ['guards'],
      stopOnApplicationShutdown: true,
    }),
  ],
  providers: [
    OrderWorkflowOperationsService,
    {
      provide: ORDER_WORKFLOW_OPERATIONS,
      useExisting: OrderWorkflowOperationsService,
    },
    OrderWorkflowResolver,
    OrderWorkflowSubscriptionResolver,
    OrderWorkflowSseConnections,
    OrderWorkflowSseMiddleware,
    { provide: APP_GUARD, useExisting: GraphqlOAuthResourceGuard },
  ],
})
export class OrderWorkflowGraphqlModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(OrderWorkflowSseMiddleware).forRoutes({
      path: 'graphql/stream',
      method: RequestMethod.ALL,
    });
  }
}
