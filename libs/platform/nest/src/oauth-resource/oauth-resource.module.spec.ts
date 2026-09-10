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
  it('resolves and freezes options after imported providers initialize', async () => {
    const configured = {
      audience: 'https://configured-orders.example.test',
      issuer: 'https://configured-identity.example.test/api/auth',
      jwksUrl: 'https://configured-identity.example.test/api/auth/jwks',
    };
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => configured],
          skipProcessEnv: true,
        }),
        OAuthResourceModule.registerAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: async (config: ConfigService) => ({
            audience: config.getOrThrow<string>('audience'),
            issuer: config.getOrThrow<string>('issuer'),
            jwksUrl: config.getOrThrow<string>('jwksUrl'),
          }),
        }),
      ],
    }).compile();

    try {
      const resolved = module.get<OAuthResourceOptions>(
        OAuthResourceOptionsToken,
      );
      expect(resolved).toEqual(configured);
      expect(Object.isFrozen(resolved)).toBe(true);
    } finally {
      await module.close();
    }
  });

  it('supports async factories without injected dependencies', async () => {
    const module = await Test.createTestingModule({
      imports: [
        OAuthResourceModule.registerAsync({ useFactory: () => options }),
      ],
    }).compile();

    expect(module.get(OAuthResourceOptionsToken)).toEqual(options);
    await module.close();
  });

  it('AC-308: resolves one vendor adapter behind the verifier port @spec:AC-308', async () => {
    const module = await Test.createTestingModule({
      imports: [OAuthResourceModule.register(options)],
    }).compile();

    try {
      const verifier = module.get(OAuthCredentialVerifierPort);

      expect(verifier.constructor.name).toBe(
        'BetterAuthOAuthCredentialVerifierAdapter',
      );
      expect(verifier).not.toBe(module.get(OAuthResourceService));
      expect(module.get(VerifyOAuthCredentialUseCase)).toBeInstanceOf(
        VerifyOAuthCredentialUseCase,
      );
      expect(module.get(GraphqlOAuthResourceGuard)).toBeInstanceOf(
        GraphqlOAuthResourceGuard,
      );
    } finally {
      await module.close();
    }
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
