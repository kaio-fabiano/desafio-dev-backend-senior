import { Inject, Injectable, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { OAuthResourceService } from '@desafio-dev-backend-senior/source/platform-nest';
import { DynamoDpopReplayStore } from '../infrastructure/auth/dynamo-dpop-replay.store.ts';

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
  it('uses OAuth settings loaded by ConfigModule after decorator evaluation @spec:AC-308', async () => {
    const configured = {
      GATEWAY_AUDIENCE: 'https://configured-gateway.example.test',
      IDENTITY_JWKS_URL: 'https://configured-identity.example.test/jwks',
      OAUTH_ISSUER: 'https://configured-identity.example.test/api/auth',
    };
    const testingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          isGlobal: true,
          load: [() => configured],
        }),
        GatewayAuthModule,
      ],
    }).compile();

    try {
      const resource = testingModule.get(OAuthResourceService) as unknown as {
        options: {
          audience: string;
          issuer: string;
          jwksUrl: string;
        };
      };
      expect(resource.options).toMatchObject({
        audience: configured.GATEWAY_AUDIENCE,
        issuer: configured.OAUTH_ISSUER,
        jwksUrl: configured.IDENTITY_JWKS_URL,
      });
    } finally {
      await testingModule.close();
    }
  });

  it('fails closed when production has no shared DPoP replay table @spec:AC-309', async () => {
    await expect(
      Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            ignoreEnvFile: true,
            isGlobal: true,
            load: [
              () => ({
                GATEWAY_DPOP_REPLAY_TABLE: '',
                NODE_ENV: 'production',
              }),
            ],
            skipProcessEnv: true,
          }),
          GatewayAuthModule,
        ],
      }).compile(),
    ).rejects.toThrow('Gateway DPoP replay table is required in production');
  });

  it('uses the shared issuer default and configured production replay store @spec:AC-308 @spec:AC-309', async () => {
    const testingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          isGlobal: true,
          load: [
            () => ({
              GATEWAY_DPOP_REPLAY_TABLE: 'gateway-replay-table',
              NODE_ENV: 'production',
            }),
          ],
          skipProcessEnv: true,
        }),
        GatewayAuthModule,
      ],
    }).compile();

    try {
      const resource = testingModule.get(OAuthResourceService) as unknown as {
        options: {
          dpopReplayStore?: unknown;
          issuer: string;
        };
      };
      expect(resource.options).toMatchObject({
        dpopReplayStore: expect.any(DynamoDpopReplayStore),
        issuer: 'http://identity-subgraph:3001/api/auth',
      });
    } finally {
      await testingModule.close();
    }
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
