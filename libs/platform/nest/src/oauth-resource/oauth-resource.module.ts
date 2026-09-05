import { Module, type DynamicModule } from '@nestjs/common';

import { GraphqlOAuthResourceGuard } from './graphql/oauth-resource.guard.ts';
import { OAUTH_RESOURCE_OPTIONS } from './oauth-resource.tokens.ts';
import type { OAuthResourceOptions } from './oauth-resource.types.ts';
import { OAuthResourceService } from './verification/oauth-resource.service.ts';

@Module({})
export class OAuthResourceModule {
  static register(options: OAuthResourceOptions): DynamicModule {
    return {
      module: OAuthResourceModule,
      providers: [
        {
          provide: OAUTH_RESOURCE_OPTIONS,
          useValue: Object.freeze({ ...options }),
        },
        OAuthResourceService,
        GraphqlOAuthResourceGuard,
      ],
      exports: [OAuthResourceService, GraphqlOAuthResourceGuard],
    };
  }
}
