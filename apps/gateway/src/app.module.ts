import { Module } from '@nestjs/common';
import {
  ApolloGatewayDriver,
  type ApolloGatewayDriverConfig,
} from '@nestjs/apollo';
import { IntrospectAndCompose } from '@apollo/gateway';
import { GraphQLModule } from '@nestjs/graphql';

import { verifyGatewayRequest } from './auth/token-verifier.ts';
import { AuthenticatedDataSource } from './federation/authenticated-data-source.ts';
import { HealthController } from './health.controller.ts';

export class AppModule {}

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
        supergraphSdl: new IntrospectAndCompose({
          subgraphs: [
            {
              name: 'identity',
              url:
                process.env.IDENTITY_GRAPHQL_URL ??
                'http://identity-subgraph:3001/graphql',
            },
            {
              name: 'catalog',
              url:
                process.env.CATALOG_GRAPHQL_URL ??
                'http://wordpress-integration/graphql',
            },
            {
              name: 'commerce',
              url:
                process.env.COMMERCE_GRAPHQL_URL ??
                'http://commerce-subgraph:3003/graphql',
            },
          ],
        }),
        buildService: ({ url }) => new AuthenticatedDataSource({ url }),
      },
    }),
  ],
  controllers: [HealthController],
})(AppModule);
