import { Module } from '@nestjs/common';
import {
  ApolloGatewayDriver,
  type ApolloGatewayDriverConfig,
} from '@nestjs/apollo';
import { LocalCompose } from '@apollo/gateway';
import { GraphQLModule } from '@nestjs/graphql';
import { parse } from 'graphql';

import { verifyGatewayRequest } from './auth/token-verifier.ts';
import { AuthenticatedDataSource } from './federation/authenticated-data-source.ts';
import { HealthController } from './health.controller.ts';

export class AppModule {}

function contract(name: 'identity' | 'catalog' | 'commerce') {
  return parse(
    readFileSync(
      resolve(`libs/contracts/graphql/${name}/schema.graphql`),
      'utf8',
    ),
  );
}

Module({
  imports: [
    GraphQLModule.forRoot<ApolloGatewayDriverConfig>({
      driver: ApolloGatewayDriver,
      path: '/graphql',
      server: {
        context: async ({
          req,
        }: {
          req: {
            protocol: string;
            originalUrl: string;
            headers: Record<string, string>;
          };
        }) =>
          verifyGatewayRequest(
            new Request(
              `${req.protocol}://${req.headers.host}${req.originalUrl}`,
              { headers: req.headers },
            ),
            {
              issuer:
                process.env.OAUTH_ISSUER ??
                'http://identity-subgraph:3001/api/auth',
              audience:
                process.env.GATEWAY_AUDIENCE ??
                'https://gateway.marketplace.local',
              requiredScopes: ['marketplace:read'],
            },
          ),
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
  ],
  controllers: [HealthController],
})(AppModule);
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
