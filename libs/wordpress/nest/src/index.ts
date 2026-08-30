import { Module } from '@nestjs/common';

import {
  WORDPRESS_FEDERATION_CONFIG,
  WordPressFederationModule as WordPressProxyModule,
  type WordPressFederationConfig,
} from './federation/wordpress-federation.module.ts';
import { SubscriptionsModule } from './subscriptions/subscriptions.module.ts';

export class WordPressFederationModule {}

Module({
  imports: [WordPressProxyModule, SubscriptionsModule],
  exports: [WordPressProxyModule, SubscriptionsModule],
})(WordPressFederationModule);

export { WORDPRESS_FEDERATION_CONFIG, type WordPressFederationConfig };
export {
  WpGraphqlClientService,
  normalizeWordPressSdl,
  type WpGraphqlProxyRequest,
  type WpGraphqlProxyResponse,
} from './federation/wpgraphql-client.service.ts';
export {
  WpGraphqlAuthorizationError,
  createWpGraphqlAuth,
  type WpGraphqlAuth,
  type WpGraphqlOperation,
} from './federation/wpgraphql-auth.factory.ts';
export { GraphqlSseAdapter } from './subscriptions/graphql-sse.adapter.ts';
export { OrderEventResolver } from './subscriptions/order-event.resolver.ts';
export {
  OrderEventService,
  type OrderEvent,
  type RoutedOrderEvent,
} from './subscriptions/order-event.service.ts';
export { SubscriptionsModule } from './subscriptions/subscriptions.module.ts';
export { WordPressCheckoutEventSource } from './subscriptions/wordpress-checkout-event.source.ts';
export {
  SUBSCRIPTION_TOKEN_OPTIONS,
  SubscriptionAuthGuard,
  subscriptionTokenOptions,
  type SubscriptionContext,
  type SubscriptionTokenOptions,
} from './subscriptions/subscription-auth.guard.ts';
