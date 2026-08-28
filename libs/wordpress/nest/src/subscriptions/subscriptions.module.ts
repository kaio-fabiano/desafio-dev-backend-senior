import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';

import { GraphqlSseAdapter } from './graphql-sse.adapter.ts';
import { OrderEventResolver } from './order-event.resolver.ts';
import { OrderEventService } from './order-event.service.ts';
import { SubscriptionAuthGuard } from './subscription-auth.guard.ts';

export class SubscriptionsModule {}

Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      path: '/graphql/subscriptions',
    }),
  ],
  providers: [
    OrderEventService,
    SubscriptionAuthGuard,
    OrderEventResolver,
    GraphqlSseAdapter,
  ],
  exports: [OrderEventService, SubscriptionAuthGuard, GraphqlSseAdapter],
})(SubscriptionsModule);
