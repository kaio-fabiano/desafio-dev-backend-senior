import { LocalCompose, type ServiceEndpointDefinition } from '@apollo/gateway';
import {
  ApolloGatewayDriver,
  type ApolloGatewayDriverConfig,
} from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { parse } from 'graphql';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { AuthContextFactory } from './auth/auth-context.factory.ts';
import { GatewayAuthModule } from './auth/gateway-auth.module.ts';
import {
  AuthenticatedDataSource,
  type FederationCapabilities,
} from './federation/authenticated-data-source.ts';

// Review: docs/reviews/gateway-auth-refactor.md
type SubgraphName = 'identity' | 'wordpress' | 'payment' | 'order-workflow';

function contract(name: SubgraphName) {
  return parse(
    readFileSync(
      resolve(`libs/contracts/graphql/${name}/schema.graphql`),
      'utf8',
    ),
  );
}

export function gatewayDriverConfig(
  authContextFactory: AuthContextFactory,
  config: ConfigService,
): Omit<ApolloGatewayDriverConfig, 'driver'> {
  return {
    server: {
      path: '/graphql',
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
            url: config.get(
              'IDENTITY_GRAPHQL_URL',
              'http://identity-subgraph:3001/graphql',
            ),
            typeDefs: contract('identity'),
          },
          {
            name: 'wordpress',
            url: config.get(
              'WORDPRESS_GRAPHQL_URL',
              'http://wordpress/graphql',
            ),
            typeDefs: contract('wordpress'),
          },
          {
            name: 'payment',
            url: config.get(
              'PAYMENT_GRAPHQL_URL',
              'http://payment-federation:8080/graphql',
            ),
            typeDefs: contract('payment'),
          },
          {
            name: 'order-workflow',
            url: config.get(
              'ORDER_WORKFLOW_GRAPHQL_URL',
              'http://order-workflow-subgraph:3003/graphql',
            ),
            typeDefs: contract('order-workflow'),
          },
        ],
      }),
      buildService: ({ name, url }: ServiceEndpointDefinition) => {
        if (!url) throw new Error(`Subgraph ${name} URL is required`);
        return new AuthenticatedDataSource({
          capabilities: federationCapabilities(name, url),
          url,
        });
      },
    },
  };
}

export function federationCapabilities(
  name: string,
  url: string,
): FederationCapabilities {
  switch (name) {
    case 'identity':
    case 'payment':
      return { bearer: true };
    case 'wordpress':
      return {
        origin: new URL(url).origin,
        requestSession: true,
        responseSession: true,
      };
    case 'order-workflow':
      return { bearer: true, requestSession: true };
    default:
      return {};
  }
}

@Module({
  imports: [
    GatewayAuthModule,
    GraphQLModule.forRootAsync<ApolloGatewayDriverConfig>({
      driver: ApolloGatewayDriver,
      imports: [GatewayAuthModule],
      inject: [AuthContextFactory, ConfigService],
      useFactory: gatewayDriverConfig,
    }),
  ],
  exports: [GatewayAuthModule],
})
export class GatewayModule {}
