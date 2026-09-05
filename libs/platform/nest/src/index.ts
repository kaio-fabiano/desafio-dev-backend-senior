export { GraphqlOAuthResourceGuard } from './oauth-resource/graphql/oauth-resource.guard.ts';
export { OAuthSubject } from './oauth-resource/graphql/oauth-subject.decorator.ts';
export { RequireScopes } from './oauth-resource/graphql/require-scopes.decorator.ts';
export { OAuthResourceModule } from './oauth-resource/oauth-resource.module.ts';
export {
  type OAuthClaims,
  type OAuthResourceOptions,
} from './oauth-resource/oauth-resource.types.ts';
export { toOAuthRequest } from './oauth-resource/verification/oauth-request.adapter.ts';
export {
  isOAuthCredentialError,
  OAuthCredentialError,
} from './oauth-resource/verification/oauth-resource.errors.ts';
export { OAuthResourceService } from './oauth-resource/verification/oauth-resource.service.ts';
