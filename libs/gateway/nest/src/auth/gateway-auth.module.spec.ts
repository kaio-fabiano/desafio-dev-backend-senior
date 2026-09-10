import { Inject, Injectable, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { AuthContextFactory } from './auth-context.factory.ts';
import { GatewayAuthModule } from './gateway-auth.module.ts';
import { TokenVerifierService } from './token-verifier.service.ts';

@Injectable()
class AuthConsumer {
  constructor(
    @Inject(AuthContextFactory)
    readonly contextFactory: AuthContextFactory,
    @Inject(TokenVerifierService)
    readonly tokenVerifier: TokenVerifierService,
  ) {}
}

@Module({ imports: [GatewayAuthModule], providers: [AuthConsumer] })
class ConsumerModule {}

describe('GatewayAuthModule', () => {
  it('resolves OAuth settings after ConfigModule loading @spec:AC-305', async () => {
    const configured = {
      GATEWAY_AUDIENCE: 'https://configured-gateway.example.test',
      IDENTITY_JWKS_URL: 'https://configured-identity.example.test/jwks',
      OAUTH_ISSUER: 'urn:configured-after-module-evaluation',
    };

    await expect(
      Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            ignoreEnvFile: true,
            isGlobal: true,
            load: [() => configured],
            skipProcessEnv: true,
          }),
          GatewayAuthModule,
        ],
      }).compile(),
    ).rejects.toThrow('OAuth issuer must be a valid URL');
  });

  it('exports the gateway authentication providers', async () => {
    const testingModule = await Test.createTestingModule({
      imports: [ConsumerModule],
    }).compile();

    const consumer = testingModule.get(AuthConsumer);

    expect(consumer.contextFactory).toBeInstanceOf(AuthContextFactory);
    expect(consumer.tokenVerifier).toBeInstanceOf(TokenVerifierService);
    await testingModule.close();
  });
});
