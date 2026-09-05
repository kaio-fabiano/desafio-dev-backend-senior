import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { OAuthResourceModule } from '@desafio-dev-backend-senior/source/platform-nest';
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
  providers: [TokenVerifierService, AuthContextFactory],
  exports: [TokenVerifierService, AuthContextFactory],
})
export class GatewayAuthModule {}
