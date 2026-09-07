export { GraphqlOAuthResourceGuard } from './oauth-resource/graphql/oauth-resource.guard.ts';
export { OAuthSubject } from './oauth-resource/graphql/oauth-subject.decorator.ts';
export { RequireScopes } from './oauth-resource/graphql/require-scopes.decorator.ts';
export { OAuthResourceModule } from './oauth-resource/oauth-resource.module.ts';
export type { OAuthClaims } from './oauth-resource/oauth-claims.ts';
export type { OAuthGraphQLContext } from './oauth-resource/oauth-graphql-context.ts';
export type { OAuthHttpRequest } from './oauth-resource/oauth-http-request.ts';
export type { OAuthResourceOptions } from './oauth-resource/oauth-resource.types.ts';
export {
  OAuthRequestAdapter,
  toOAuthRequest,
} from './oauth-resource/verification/oauth-request.adapter.ts';
export {
  isOAuthCredentialError,
  OAuthCredentialError,
} from './oauth-resource/verification/oauth-resource.errors.ts';
export { OAuthAuthenticationMessages } from './oauth-resource/verification/oauth-authentication-messages.ts';
export { OAuthResourceService } from './oauth-resource/verification/oauth-resource.service.ts';
