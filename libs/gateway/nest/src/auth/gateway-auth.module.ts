import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

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
    OAuthResourceModule.register({
      issuer:
        process.env.OAUTH_ISSUER ?? 'http://identity-subgraph:3001/api/auth',
      jwksUrl:
        process.env.IDENTITY_JWKS_URL ??
        'http://identity-subgraph:3001/api/auth/jwks',
      audience:
        process.env.GATEWAY_AUDIENCE ?? 'https://gateway.marketplace.local',
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
