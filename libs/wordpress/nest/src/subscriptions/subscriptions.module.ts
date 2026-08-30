import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';

import { GraphqlSseAdapter } from './graphql-sse.adapter.ts';
import { OrderEventResolver } from './order-event.resolver.ts';
import { OrderEventService } from './order-event.service.ts';
import {
  SUBSCRIPTION_TOKEN_OPTIONS,
  SubscriptionAuthGuard,
  subscriptionTokenOptions,
} from './subscription-auth.guard.ts';
import { WordPressCheckoutEventSource } from './wordpress-checkout-event.source.ts';

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
    {
      provide: SUBSCRIPTION_TOKEN_OPTIONS,
      useFactory: subscriptionTokenOptions,
    },
    SubscriptionAuthGuard,
    WordPressCheckoutEventSource,
    OrderEventResolver,
    GraphqlSseAdapter,
  ],
  exports: [
    OrderEventService,
    SubscriptionAuthGuard,
    WordPressCheckoutEventSource,
    GraphqlSseAdapter,
  ],
})(SubscriptionsModule);
