import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { CaptureFederationResponseUseCase } from '../application/use-cases/capture-federation-response.use-case.ts';
import { PrepareFederationRequestUseCase } from '../application/use-cases/prepare-federation-request.use-case.ts';
import { GatewayAuthModule } from '../auth/gateway-auth.module.ts';
import { GatewayFederationConfiguration } from './gateway-federation.configuration.ts';

@Module({
  imports: [ConfigModule, GatewayAuthModule],
  providers: [
    PrepareFederationRequestUseCase,
    CaptureFederationResponseUseCase,
    GatewayFederationConfiguration,
  ],
  exports: [GatewayFederationConfiguration],
})
export class GatewayFederationModule {}
