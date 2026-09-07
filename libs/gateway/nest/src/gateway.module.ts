import { ApolloGatewayDriver, type ApolloGatewayDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';

import { AuthContextFactory } from './auth/auth-context.factory.ts';
import { GatewayAuthModule } from './auth/gateway-auth.module.ts';
import { GatewayFederationConfiguration } from './federation/gateway-federation.configuration.ts';

@Module({
  imports: [
    GatewayAuthModule,
    GraphQLModule.forRootAsync<ApolloGatewayDriverConfig>({
      driver: ApolloGatewayDriver,
      imports: [GatewayAuthModule],
      inject: [AuthContextFactory, ConfigService],
      useFactory: GatewayFederationConfiguration.driverConfig,
    }),
  ],
  exports: [GatewayAuthModule],
})
export class GatewayModule {}
