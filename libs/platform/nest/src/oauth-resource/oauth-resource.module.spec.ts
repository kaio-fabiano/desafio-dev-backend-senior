import { Inject, Injectable, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';

import { OAuthCredentialVerifierPort } from './application/ports/oauth-credential-verifier.port.ts';
import { VerifyOAuthCredentialUseCase } from './application/use-cases/verify-oauth-credential.use-case.ts';
import { GraphqlOAuthResourceGuard } from './graphql/oauth-resource.guard.ts';
import { OAuthResourceModule } from './oauth-resource.module.ts';
import { OAuthResourceOptionsToken } from './oauth-resource.tokens.ts';
import type { OAuthResourceOptions } from './oauth-resource.types.ts';
import { OAuthResourceService } from './verification/oauth-resource.service.ts';

const options = {
  audience: 'https://orders.marketplace.local',
  issuer: 'https://identity.marketplace.local/api/auth',
  jwksUrl: 'https://identity.marketplace.local/api/auth/jwks',
} satisfies OAuthResourceOptions;

@Injectable()
class OAuthConsumer {
  constructor(
    @Inject(OAuthResourceService)
    readonly service: OAuthResourceService,
    @Inject(GraphqlOAuthResourceGuard)
    readonly guard: GraphqlOAuthResourceGuard,
  ) {}
}

@Module({
  imports: [OAuthResourceModule.register(options)],
  providers: [OAuthConsumer],
})
class ConsumerModule {}

describe('OAuthResourceModule', () => {
  it('resolves async options after Nest configuration loads @spec:AC-308', async () => {
    const configured = {
      GATEWAY_AUDIENCE: 'https://configured-gateway.example.test',
      IDENTITY_JWKS_URL: 'https://configured-identity.example.test/jwks',
      OAUTH_ISSUER: 'https://configured-identity.example.test/api/auth',
    };
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => configured],
        }),
        OAuthResourceModule.registerAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            audience: config.getOrThrow<string>('GATEWAY_AUDIENCE'),
            issuer: config.getOrThrow<string>('OAUTH_ISSUER'),
            jwksUrl: config.getOrThrow<string>('IDENTITY_JWKS_URL'),
          }),
        }),
      ],
    }).compile();

    try {
      expect(
        module.get<OAuthResourceOptions>(OAuthResourceOptionsToken),
      ).toEqual({
        audience: configured.GATEWAY_AUDIENCE,
        issuer: configured.OAUTH_ISSUER,
        jwksUrl: configured.IDENTITY_JWKS_URL,
      });
    } finally {
      await module.close();
    }
  });

  it('resolves async options without injected dependencies @spec:AC-308', async () => {
    const module = await Test.createTestingModule({
      imports: [
        OAuthResourceModule.registerAsync({ useFactory: () => options }),
      ],
    }).compile();

    expect(module.get<OAuthResourceOptions>(OAuthResourceOptionsToken)).toEqual(
      options,
    );
    await module.close();
  });

  it('AC-273: resolves credential verification through NestJS providers @spec:AC-273', async () => {
    const verifyCredential = vi.fn().mockResolvedValue({
      aud: options.audience,
      scope: 'orders:read',
      sub: 'buyer-1',
    });
    const module = await Test.createTestingModule({
      imports: [OAuthResourceModule.register(options)],
    })
      .overrideProvider(OAuthCredentialVerifierPort)
      .useValue({ verifyCredential })
      .compile();

    try {
      const service = module.get(OAuthResourceService);

      expect(module.get(VerifyOAuthCredentialUseCase)).toBeInstanceOf(
        VerifyOAuthCredentialUseCase,
      );
      expect(module.get(OAuthCredentialVerifierPort)).not.toBe(service);
      await expect(
        service.verify(
          new Request('https://orders.marketplace.local/graphql', {
            headers: { authorization: 'Bearer token' },
          }),
        ),
      ).resolves.toMatchObject({
        scopes: ['orders:read'],
        subject: 'buyer-1',
      });
      expect(verifyCredential).toHaveBeenCalledOnce();
    } finally {
      await module.close();
    }
  });

  it('AC-223: resolves exported providers through a NestJS consumer module @spec:AC-223', async () => {
    const module = await Test.createTestingModule({
      imports: [ConsumerModule],
    }).compile();

    const consumer = module.get(OAuthConsumer);
    expect(consumer.service).toBeInstanceOf(OAuthResourceService);
    expect(consumer.guard).toBeInstanceOf(GraphqlOAuthResourceGuard);
    await module.close();
  });

  it('fails module compilation for invalid OAuth options', async () => {
    await expect(
      Test.createTestingModule({
        imports: [OAuthResourceModule.register({ ...options, audience: '' })],
      }).compile(),
    ).rejects.toThrow('OAuth audience must be a valid URL');
  });

  it('captures an immutable option snapshot during registration', async () => {
    const mutable = { ...options };
    const registered = OAuthResourceModule.register(mutable);
    mutable.audience = '';

    const module = await Test.createTestingModule({
      imports: [registered],
    }).compile();
    const snapshot = module.get<OAuthResourceOptions>(
      OAuthResourceOptionsToken,
    );

    expect(snapshot.audience).toBe(options.audience);
    expect(Object.isFrozen(snapshot)).toBe(true);
    await module.close();
  });

  it('isolates options across independent NestJS containers', async () => {
    const gateway = await Test.createTestingModule({
      imports: [OAuthResourceModule.register(options)],
    }).compile();
    const identityOptions = {
      ...options,
      audience: 'https://identity.marketplace.local',
    };
    const identity = await Test.createTestingModule({
      imports: [OAuthResourceModule.register(identityOptions)],
    }).compile();

    expect(
      gateway.get<OAuthResourceOptions>(OAuthResourceOptionsToken).audience,
    ).toBe(options.audience);
    expect(
      identity.get<OAuthResourceOptions>(OAuthResourceOptionsToken).audience,
    ).toBe(identityOptions.audience);
    await Promise.all([gateway.close(), identity.close()]);
  });
});
