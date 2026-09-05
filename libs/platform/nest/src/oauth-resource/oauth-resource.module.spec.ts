import { Inject, Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { describe, expect, it } from 'vitest';

import { GraphqlOAuthResourceGuard } from './graphql/oauth-resource.guard.ts';
import { OAuthResourceModule } from './oauth-resource.module.ts';
import { OAUTH_RESOURCE_OPTIONS } from './oauth-resource.tokens.ts';
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
        imports: [
          OAuthResourceModule.register({ ...options, audience: '' }),
        ],
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
    const snapshot = module.get<OAuthResourceOptions>(OAUTH_RESOURCE_OPTIONS);

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
      gateway.get<OAuthResourceOptions>(OAUTH_RESOURCE_OPTIONS).audience,
    ).toBe(options.audience);
    expect(
      identity.get<OAuthResourceOptions>(OAUTH_RESOURCE_OPTIONS).audience,
    ).toBe(identityOptions.audience);
    await Promise.all([gateway.close(), identity.close()]);
  });
});
