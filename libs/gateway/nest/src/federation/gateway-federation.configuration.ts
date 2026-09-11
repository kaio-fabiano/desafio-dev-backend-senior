import { LocalCompose, type ServiceEndpointDefinition } from '@apollo/gateway';
import type { ApolloGatewayDriverConfig } from '@nestjs/apollo';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { parse } from 'graphql';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { FederationCapabilities } from '../application/dto/federation-capabilities.dto.ts';
import { GatewayErrorMessages } from '../application/gateway-error-messages.ts';
import { CaptureFederationResponseUseCase } from '../application/use-cases/capture-federation-response.use-case.ts';
import { PrepareFederationRequestUseCase } from '../application/use-cases/prepare-federation-request.use-case.ts';
import { AuthContextFactory } from '../auth/auth-context.factory.ts';
import { AuthenticatedDataSource } from './authenticated-data-source.ts';

@Injectable()
export class GatewayFederationConfiguration {
  constructor(
    @Inject(AuthContextFactory)
    private readonly authContextFactory: AuthContextFactory,
    @Inject(ConfigService)
    private readonly config: ConfigService,
    @Inject(PrepareFederationRequestUseCase)
    private readonly prepareRequest: PrepareFederationRequestUseCase,
    @Inject(CaptureFederationResponseUseCase)
    private readonly captureResponse: CaptureFederationResponseUseCase,
  ) {}

  createGqlOptions(): Omit<ApolloGatewayDriverConfig, 'driver'> {
    return {
      server: {
        path: '/graphql',
        context: ({
          req,
          res,
        }: {
          req: Parameters<AuthContextFactory['create']>[0];
          res: Parameters<AuthContextFactory['create']>[1];
        }) => this.authContextFactory.create(req, res),
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
            url: this.config.get(
              `${name.replace('-', '_').toUpperCase()}_GRAPHQL_URL`,
              GatewayFederationConfiguration.defaultUrl(name),
            ),
            typeDefs: GatewayFederationConfiguration.contract(name),
          })),
        }),
        buildService: ({ name, url }: ServiceEndpointDefinition) => {
          if (!url)
            throw new Error(GatewayErrorMessages.subgraphUrlIsRequired(name));
          return new AuthenticatedDataSource(
            {
              capabilities: GatewayFederationConfiguration.capabilities(
                name,
                url,
              ),
              url,
            },
            this.prepareRequest,
            this.captureResponse,
          );
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
        wordpressCredential: true,
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
    return 'http://payment-federation:8080/graphql';
  }
}
