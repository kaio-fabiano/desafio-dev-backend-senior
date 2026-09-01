import { LocalCompose } from '@apollo/gateway';
import {
  ApolloGatewayDriver,
  type ApolloGatewayDriverConfig,
} from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { parse } from 'graphql';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { AuthContextFactory } from './auth/auth-context.factory.ts';
import {
  GATEWAY_TOKEN_OPTIONS,
  TokenVerifierService,
  gatewayTokenOptions,
} from './auth/token-verifier.service.ts';
import { AuthenticatedDataSource } from './federation/authenticated-data-source.ts';

function contract(
  name: 'identity' | 'wordpress' | 'payment' | 'order-workflow',
) {
  return parse(
    readFileSync(
      resolve(`libs/contracts/graphql/${name}/schema.graphql`),
      'utf8',
    ),
  );
}

export class GatewayAuthProvidersModule {}

Module({
  providers: [
    { provide: GATEWAY_TOKEN_OPTIONS, useFactory: gatewayTokenOptions },
    TokenVerifierService,
    AuthContextFactory,
  ],
  exports: [TokenVerifierService, AuthContextFactory],
})(GatewayAuthProvidersModule);

export class GatewayModule {}

Module({
  imports: [
    GatewayAuthProvidersModule,
    GraphQLModule.forRootAsync<ApolloGatewayDriverConfig>({
      driver: ApolloGatewayDriver,
      imports: [GatewayAuthProvidersModule],
      inject: [AuthContextFactory],
      useFactory: (authContextFactory: AuthContextFactory) => ({
        driver: ApolloGatewayDriver,
        path: '/graphql',
        server: {
          context: ({
            req,
            res,
          }: {
            req: Parameters<AuthContextFactory['create']>[0];
            res: Parameters<AuthContextFactory['create']>[1];
          }) => authContextFactory.create(req, res),
        },
        gateway: {
          supergraphSdl: new LocalCompose({
            localServiceList: [
              {
                name: 'identity',
                url:
                  process.env.IDENTITY_GRAPHQL_URL ??
                  'http://identity-subgraph:3001/graphql',
                typeDefs: contract('identity'),
              },
              {
                name: 'wordpress',
                url:
                  process.env.WORDPRESS_GRAPHQL_URL ??
                  'http://wordpress/graphql',
                typeDefs: contract('wordpress'),
              },
              {
                name: 'payment',
                url:
                  process.env.PAYMENT_GRAPHQL_URL ??
                  'http://payment-processor:8080/graphql',
                typeDefs: contract('payment'),
              },
              {
                name: 'order-workflow',
                url:
                  process.env.ORDER_WORKFLOW_GRAPHQL_URL ??
                  'http://order-workflow-subgraph:3003/graphql',
                typeDefs: contract('order-workflow'),
              },
            ],
          }),
          buildService: ({ name, url }) => {
            if (!url) throw new Error(`Subgraph ${name} URL is required`);
            return new AuthenticatedDataSource({
              url,
              internalSecret:
                process.env.FEDERATION_INTERNAL_SECRET ??
                'federation-local-only',
              kind:
                name === 'wordpress' || name === 'order-workflow'
                  ? name
                  : 'other',
            });
          },
        },
      }),
    }),
  ],
  exports: [GatewayAuthProvidersModule],
})(GatewayModule);
