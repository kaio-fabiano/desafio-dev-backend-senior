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

export const WORDPRESS_FEDERATION_CONFIG = Symbol(
  'WORDPRESS_FEDERATION_CONFIG',
);
const WPGRAPHQL_AUTH = Symbol('WPGRAPHQL_AUTH');

export type WordPressFederationConfig = {
  endpoint: string;
  port: number;
  proxySecret: string;
};

function wordpressFederationConfig(): WordPressFederationConfig {
  const proxySecret = process.env.WPGRAPHQL_FEDERATION_SECRET?.trim() ?? '';
  if (!proxySecret) {
    throw new Error('WPGRAPHQL_FEDERATION_SECRET is required');
  }
  return {
    endpoint: process.env.WPGRAPHQL_ENDPOINT ?? 'http://wordpress/graphql',
    port: Number(process.env.PORT ?? 3004),
    proxySecret,
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
  providers: [
    {
      provide: WORDPRESS_FEDERATION_CONFIG,
      useFactory: wordpressFederationConfig,
    },
    {
      provide: WPGRAPHQL_AUTH,
      inject: [WORDPRESS_FEDERATION_CONFIG],
      useFactory: (config: WordPressFederationConfig): WpGraphqlAuth =>
        createWpGraphqlAuth({ proxySecret: config.proxySecret }),
    },
    {
      provide: WpGraphqlClientService,
      inject: [WORDPRESS_FEDERATION_CONFIG, WPGRAPHQL_AUTH],
      useFactory: (config: WordPressFederationConfig, auth: WpGraphqlAuth) =>
        new WpGraphqlClientService({ endpoint: config.endpoint, auth }),
    },
  ],
  exports: [WpGraphqlClientService, WORDPRESS_FEDERATION_CONFIG],
})(WordPressFederationModule);
