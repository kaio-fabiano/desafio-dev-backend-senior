export {
  PlatformConfigModule,
} from './config/config.module.ts';
export {
  ENVIRONMENT,
  environmentFactory,
  type Environment,
} from './config/environment.factory.ts';
export {
  type ManagedResource,
  ResourceProvider,
} from './lifecycle/resource.provider.ts';
export {
  GraphqlOAuthResourceGuard,
  OAuthSubject,
  RequireScopes,
} from './auth/oauth-resource.guard.ts';
export { OAuthResourceModule } from './auth/oauth-resource.module.ts';
export {
  OAUTH_RESOURCE_OPTIONS,
  OAuthResourceService,
  type OAuthClaims,
  type OAuthResourceOptions,
  toOAuthRequest,
} from './auth/oauth-resource.service.ts';
