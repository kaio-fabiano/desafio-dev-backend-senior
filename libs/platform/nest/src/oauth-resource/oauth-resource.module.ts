import { Module, type DynamicModule, type Provider } from '@nestjs/common';

import { OAuthCredentialVerifierPort } from './application/ports/oauth-credential-verifier.port.ts';
import { VerifyOAuthCredentialUseCase } from './application/use-cases/verify-oauth-credential.use-case.ts';
import { GraphqlOAuthResourceGuard } from './graphql/oauth-resource.guard.ts';
import { OAuthResourceOptionsToken } from './oauth-resource.tokens.ts';
import type {
  OAuthResourceAsyncOptions,
  OAuthResourceOptions,
} from './oauth-resource.types.ts';
import { OAuthResourceService } from './verification/oauth-resource.service.ts';

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

  private static providers(options: Provider): Provider[] {
    return [
      options,
      {
        provide: OAuthCredentialVerifierPort,
        inject: [OAuthResourceOptionsToken],
        useFactory: (resourceOptions: OAuthResourceOptions) =>
          new OAuthResourceService(resourceOptions),
      },
      VerifyOAuthCredentialUseCase,
      OAuthResourceService,
      GraphqlOAuthResourceGuard,
    ];
  }
}
