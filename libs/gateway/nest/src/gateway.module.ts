import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { LocalCompose } from '@apollo/gateway';
import {
  ApolloGatewayDriver,
  type ApolloGatewayDriverConfig,
} from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { parse } from 'graphql';

import { AuthContextFactory } from './auth/auth-context.factory.ts';
import {
  GATEWAY_TOKEN_OPTIONS,
  TokenVerifierService,
  gatewayTokenOptions,
} from './auth/token-verifier.service.ts';
import { AuthenticatedDataSource } from './federation/authenticated-data-source.ts';

function contract(name: 'identity' | 'catalog' | 'commerce') {
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
          }: {
            req: Parameters<AuthContextFactory['create']>[0];
          }) => authContextFactory.create(req),
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
                name: 'catalog',
                url:
                  process.env.CATALOG_GRAPHQL_URL ??
                  'http://wordpress-integration/graphql',
                typeDefs: contract('catalog'),
              },
              {
                name: 'commerce',
                url:
                  process.env.COMMERCE_GRAPHQL_URL ??
                  'http://commerce-subgraph:3003/graphql',
                typeDefs: contract('commerce'),
              },
            ],
          }),
          buildService: ({ url }) => new AuthenticatedDataSource({ url }),
        },
      }),
    }),
  ],
  exports: [GatewayAuthProvidersModule],
})(GatewayModule);
