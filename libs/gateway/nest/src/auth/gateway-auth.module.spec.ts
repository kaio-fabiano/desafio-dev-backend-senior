import { Inject, Injectable, Module } from '@nestjs/common';
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
