import { Module, type DynamicModule } from '@nestjs/common';

import { OAuthCredentialVerifierPort } from './application/ports/oauth-credential-verifier.port.ts';
import { VerifyOAuthCredentialUseCase } from './application/use-cases/verify-oauth-credential.use-case.ts';
import { GraphqlOAuthResourceGuard } from './graphql/oauth-resource.guard.ts';
import { BetterAuthOAuthCredentialVerifierAdapter } from './infrastructure/better-auth-oauth-credential-verifier.adapter.ts';
import { OAuthResourceOptionsToken } from './oauth-resource.tokens.ts';
import type { OAuthResourceOptions } from './oauth-resource.types.ts';
import { OAuthResourceService } from './verification/oauth-resource.service.ts';

@Module({})
export class OAuthResourceModule {
  static register(options: OAuthResourceOptions): DynamicModule {
    return {
      module: OAuthResourceModule,
      providers: [
        {
          provide: OAuthResourceOptionsToken,
          useValue: Object.freeze({ ...options }),
        },
        {
          provide: OAuthCredentialVerifierPort,
          useClass: BetterAuthOAuthCredentialVerifierAdapter,
        },
        VerifyOAuthCredentialUseCase,
        OAuthResourceService,
        GraphqlOAuthResourceGuard,
      ],
      exports: [OAuthResourceService, GraphqlOAuthResourceGuard],
    };
  }
}
