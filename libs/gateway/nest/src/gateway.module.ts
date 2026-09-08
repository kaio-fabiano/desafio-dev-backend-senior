import {
  ApolloGatewayDriver,
  type ApolloGatewayDriverConfig,
} from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';

import { GatewayAuthModule } from './auth/gateway-auth.module.ts';
import { GatewayFederationConfiguration } from './federation/gateway-federation.configuration.ts';
import { GatewayFederationModule } from './federation/gateway-federation.module.ts';

@Module({
  imports: [
    GatewayAuthModule,
    GatewayFederationModule,
    GraphQLModule.forRootAsync<ApolloGatewayDriverConfig>({
      driver: ApolloGatewayDriver,
      imports: [GatewayFederationModule],
      useExisting: GatewayFederationConfiguration,
    }),
  ],
  exports: [GatewayAuthModule],
})
export class GatewayModule {}
