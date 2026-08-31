import {
  Inject,
  Module,
  RequestMethod,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';

import {
  WpGraphqlClientService,
  type WpGraphqlProxyRequest,
  type WpGraphqlProxyResponse,
} from './wpgraphql-client.service.ts';
import {
  createWpGraphqlAuth,
  type WpGraphqlAuth,
} from './wpgraphql-auth.factory.ts';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module.ts';
import { WordPressCheckoutEventSource } from '../subscriptions/wordpress-checkout-event.source.ts';

export const WORDPRESS_FEDERATION_CONFIG = Symbol(
  'WORDPRESS_FEDERATION_CONFIG',
);
const WPGRAPHQL_AUTH = Symbol('WPGRAPHQL_AUTH');

export type WordPressFederationConfig = {
  endpoint: string;
  port: number;
  siteToken: string;
};

function wordpressFederationConfig(): WordPressFederationConfig {
  const siteToken = process.env.WPGRAPHQL_SITE_TOKEN?.trim() ?? '';
  if (!siteToken) {
    throw new Error('WPGRAPHQL_SITE_TOKEN is required');
  }
  return {
    endpoint: process.env.WPGRAPHQL_ENDPOINT ?? 'http://wordpress/graphql',
    port: Number(process.env.PORT ?? 3004),
    siteToken,
  };
}

export class WordPressFederationModule implements NestModule {
  constructor(private readonly client: WpGraphqlClientService) {}

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(
        (
          request: WpGraphqlProxyRequest,
          response: WpGraphqlProxyResponse,
          next: (error?: unknown) => void,
        ) => {
          this.client.forward(request, response).catch(next);
        },
      )
      .forRoutes({ path: 'graphql', method: RequestMethod.POST });
  }
}

Inject(WpGraphqlClientService)(WordPressFederationModule, undefined, 0);
Module({
  imports: [SubscriptionsModule],
  providers: [
    {
      provide: WORDPRESS_FEDERATION_CONFIG,
      useFactory: wordpressFederationConfig,
    },
    {
      provide: WPGRAPHQL_AUTH,
      inject: [WORDPRESS_FEDERATION_CONFIG],
      useFactory: (config: WordPressFederationConfig): WpGraphqlAuth =>
        createWpGraphqlAuth({
          endpoint: config.endpoint,
          siteToken: config.siteToken,
        }),
    },
    {
      provide: WpGraphqlClientService,
      inject: [
        WORDPRESS_FEDERATION_CONFIG,
        WPGRAPHQL_AUTH,
        WordPressCheckoutEventSource,
      ],
      useFactory: (
        config: WordPressFederationConfig,
        auth: WpGraphqlAuth,
        checkoutEvents: WordPressCheckoutEventSource,
      ) =>
        new WpGraphqlClientService({
          endpoint: config.endpoint,
          auth,
          checkoutEvents,
        }),
    },
  ],
  exports: [WpGraphqlClientService, WORDPRESS_FEDERATION_CONFIG],
})(WordPressFederationModule);
