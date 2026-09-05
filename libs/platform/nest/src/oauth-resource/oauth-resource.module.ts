import { Module, type DynamicModule } from '@nestjs/common';

import { GraphqlOAuthResourceGuard } from './graphql/oauth-resource.guard.ts';
import { OAUTH_RESOURCE_OPTIONS } from './oauth-resource.tokens.ts';
import type { OAuthResourceOptions } from './oauth-resource.types.ts';
import { OAuthResourceService } from './verification/oauth-resource.service.ts';

// TODO(oauth-resource-module): Validate OAuth resource options during
// application bootstrap. Require a non-empty audience and valid issuer/JWKS
// URLs, enforcing secure production URLs while allowing explicitly configured
// internal development endpoints. Add Nest TestingModule coverage proving
// service and guard resolution, exported-provider availability, independent
// audience registrations, and fail-fast behavior for invalid configuration.
// Preserve runtime-applied Module() metadata until the direct Node TypeScript
// execution strategy is migrated and validated.

export class OAuthResourceModule {
  static register(options: OAuthResourceOptions): DynamicModule {
    return {
      module: OAuthResourceModule,
      providers: [
        { provide: OAUTH_RESOURCE_OPTIONS, useValue: options },
        OAuthResourceService,
        GraphqlOAuthResourceGuard,
      ],
      exports: [OAuthResourceService, GraphqlOAuthResourceGuard],
    };
  }
}

Module({})(OAuthResourceModule);
