import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { WordPressCredentialPort } from '../application/ports/wordpress-credential.port.ts';
import { CaptureFederationResponseUseCase } from '../application/use-cases/capture-federation-response.use-case.ts';
import { PrepareFederationRequestUseCase } from '../application/use-cases/prepare-federation-request.use-case.ts';
import { GatewayAuthModule } from '../auth/gateway-auth.module.ts';
import { WpGraphqlCredentialAdapter } from '../infrastructure/http/wp-graphql-credential.adapter.ts';
import { GatewayFederationConfiguration } from './gateway-federation.configuration.ts';

@Module({
  imports: [ConfigModule, GatewayAuthModule],
  providers: [
    WpGraphqlCredentialAdapter,
    {
      provide: WordPressCredentialPort,
      useExisting: WpGraphqlCredentialAdapter,
    },
    PrepareFederationRequestUseCase,
    CaptureFederationResponseUseCase,
    GatewayFederationConfiguration,
  ],
  exports: [GatewayFederationConfiguration],
})
export class GatewayFederationModule {}
