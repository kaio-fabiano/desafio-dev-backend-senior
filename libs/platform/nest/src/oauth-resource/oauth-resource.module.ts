import {
  Module,
  type DynamicModule,
  type FactoryProvider,
  type ModuleMetadata,
  type Provider,
} from '@nestjs/common';

import { OAuthCredentialVerifierPort } from './application/ports/oauth-credential-verifier.port.ts';
import { VerifyOAuthCredentialUseCase } from './application/use-cases/verify-oauth-credential.use-case.ts';
import { GraphqlOAuthResourceGuard } from './graphql/oauth-resource.guard.ts';
import { BetterAuthOAuthCredentialVerifierAdapter } from './infrastructure/better-auth-oauth-credential-verifier.adapter.ts';
import { OAuthResourceOptionsToken } from './oauth-resource.tokens.ts';
import type { OAuthResourceOptions } from './oauth-resource.types.ts';
import { OAuthResourceService } from './verification/oauth-resource.service.ts';

type OAuthResourceAsyncOptions = Pick<ModuleMetadata, 'imports'> &
  Pick<FactoryProvider<OAuthResourceOptions>, 'inject' | 'useFactory'>;

@Module({})
export class OAuthResourceModule {
  static register(options: OAuthResourceOptions): DynamicModule {
    return {
      module: OAuthResourceModule,
      providers: this.providers({
        provide: OAuthResourceOptionsToken,
        useValue: Object.freeze({ ...options }),
      }),
      exports: [OAuthResourceService, GraphqlOAuthResourceGuard],
    };
  }

  static registerAsync(options: OAuthResourceAsyncOptions): DynamicModule {
    return {
      module: OAuthResourceModule,
      imports: options.imports,
      providers: this.providers({
        provide: OAuthResourceOptionsToken,
        inject: options.inject ?? [],
        useFactory: async (...dependencies: unknown[]) =>
          Object.freeze({ ...(await options.useFactory(...dependencies)) }),
      }),
      exports: [OAuthResourceService, GraphqlOAuthResourceGuard],
    };
  }

  private static providers(optionsProvider: Provider): Provider[] {
    return [
      optionsProvider,
      {
        provide: OAuthCredentialVerifierPort,
        useClass: BetterAuthOAuthCredentialVerifierAdapter,
      },
      VerifyOAuthCredentialUseCase,
      OAuthResourceService,
      GraphqlOAuthResourceGuard,
    ];
  }
}
