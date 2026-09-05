export { GraphqlOAuthResourceGuard } from './oauth-resource/graphql/oauth-resource.guard.ts';
export { OAuthSubject } from './oauth-resource/graphql/oauth-subject.decorator.ts';
export { RequireScopes } from './oauth-resource/graphql/require-scopes.decorator.ts';
export { OAuthResourceModule } from './oauth-resource/oauth-resource.module.ts';
export {
  type OAuthClaims,
  type OAuthResourceOptions,
} from './oauth-resource/oauth-resource.types.ts';
export { toOAuthRequest } from './oauth-resource/verification/oauth-request.adapter.ts';
export { OAuthResourceService } from './oauth-resource/verification/oauth-resource.service.ts';
export { PlatformConfigModule } from './config/config.module.ts';
export {
  ENVIRONMENT,
  environmentFactory,
  type Environment,
} from './config/environment.factory.ts';
export {
  ResourceProvider,
  type ManagedResource,
} from './lifecycle/resource.provider.ts';

// TODO(platform-nest-public-api): Review and minimize the public API of this
// library after the configuration and lifecycle TODOs are resolved. Export
// only symbols required by external consumers and keep provider tokens,
// factories, implementation details, and unused abstractions private.
//
// Preserve this index as the package entrypoint for `platform-nest`. Remove
// ResourceProvider and ManagedResource exports if the unused lifecycle
// abstraction is deleted. Expose typed configuration contracts and tokens only
// when PlatformConfigModule is integrated into application roots. Keep OAuth
// modules, guards, decorators, services, request conversion, and externally
// consumed types public.
//
// Add an API-surface test that imports the supported public symbols through the
// package subpath instead of inspecting this file with regular expressions.
// Introduce additional package subpaths only when the library grows enough to
// require independent entrypoints.
