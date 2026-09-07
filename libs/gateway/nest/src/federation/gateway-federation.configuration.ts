import { LocalCompose, type ServiceEndpointDefinition } from '@apollo/gateway';
import type { ApolloGatewayDriverConfig } from '@nestjs/apollo';
import type { ConfigService } from '@nestjs/config';
import { parse } from 'graphql';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { FederationCapabilities } from '../application/dto/federation-capabilities.dto.ts';
import type { AuthContextFactory } from '../auth/auth-context.factory.ts';
import { AuthenticatedDataSource } from './authenticated-data-source.ts';

export class GatewayFederationConfiguration {
  static driverConfig(
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
            'identity',
            'wordpress',
            'payment',
            'order-workflow',
          ].map((name) => ({
            name,
            url: config.get(
              `${name.replace('-', '_').toUpperCase()}_GRAPHQL_URL`,
              GatewayFederationConfiguration.defaultUrl(name),
            ),
            typeDefs: GatewayFederationConfiguration.contract(name),
          })),
        }),
        buildService: ({ name, url }: ServiceEndpointDefinition) => {
          if (!url) throw new Error(`Subgraph ${name} URL is required`);
          return new AuthenticatedDataSource({
            capabilities: GatewayFederationConfiguration.capabilities(
              name,
              url,
            ),
            url,
          });
        },
      },
    };
  }

  static capabilities(name: string, url: string): FederationCapabilities {
    if (name === 'identity' || name === 'payment') return { bearer: true };
    if (name === 'wordpress')
      return {
        origin: new URL(url).origin,
        requestSession: true,
        responseSession: true,
      };
    if (name === 'order-workflow')
      return { bearer: true, requestSession: true };
    return {};
  }

  private static contract(name: string) {
    return parse(
      readFileSync(
        resolve(`libs/contracts/graphql/${name}/schema.graphql`),
        'utf8',
      ),
    );
  }
  private static defaultUrl(name: string): string {
    if (name === 'identity') return 'http://identity-subgraph:3001/graphql';
    if (name === 'wordpress') return 'http://wordpress/graphql';
    if (name === 'payment') return 'http://payment-federation:8080/graphql';
    return 'http://order-workflow-subgraph:3003/graphql';
  }
}
