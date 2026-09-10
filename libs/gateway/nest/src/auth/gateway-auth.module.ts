import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { OAuthResourceModule } from '@desafio-dev-backend-senior/source/platform-nest';
import { CommerceCookiePort } from '../application/ports/commerce-cookie.port.ts';
import { GatewayTokenVerifierPort } from '../application/ports/gateway-token-verifier.port.ts';
import { CreateGatewayContextUseCase } from '../application/use-cases/create-gateway-context.use-case.ts';
import { CommerceCookieAdapter } from '../infrastructure/http/commerce-cookie.adapter.ts';
import { AuthContextFactory } from './auth-context.factory.ts';
import { TokenVerifierService } from './token-verifier.service.ts';

@Module({
  imports: [
    ConfigModule,
    OAuthResourceModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        issuer:
          config.get<string>('OAUTH_ISSUER') ??
          'http://identity-subgraph:3001/api/auth',
        jwksUrl:
          config.get<string>('IDENTITY_JWKS_URL') ??
          'http://identity-subgraph:3001/api/auth/jwks',
        audience:
          config.get<string>('GATEWAY_AUDIENCE') ??
          'https://gateway.marketplace.local',
      }),
    }),
  ],
  providers: [
    CommerceCookieAdapter,
    {
      provide: CommerceCookiePort,
      useExisting: CommerceCookieAdapter,
    },
    TokenVerifierService,
    {
      provide: GatewayTokenVerifierPort,
      useExisting: TokenVerifierService,
    },
    CreateGatewayContextUseCase,
    AuthContextFactory,
  ],
  exports: [CommerceCookiePort, TokenVerifierService, AuthContextFactory],
})
export class GatewayAuthModule {}
