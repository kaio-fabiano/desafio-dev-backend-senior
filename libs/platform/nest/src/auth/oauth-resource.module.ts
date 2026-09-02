import { DynamicModule, Module } from '@nestjs/common';

import { GraphqlOAuthResourceGuard } from './oauth-resource.guard.ts';
import {
  OAUTH_RESOURCE_OPTIONS,
  OAuthResourceService,
  type OAuthResourceOptions,
} from './oauth-resource.service.ts';

@Module({})
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
