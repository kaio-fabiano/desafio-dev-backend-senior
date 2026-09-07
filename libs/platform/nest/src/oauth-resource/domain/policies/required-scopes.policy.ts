import { OAuthClaims } from '../value-objects/oauth-claims.ts';

export class RequiredScopesPolicy {
  static allows(
    claims: OAuthClaims,
    requiredScopes: readonly string[],
  ): boolean {
    return requiredScopes.every((scope) => claims.scopes.includes(scope));
  }
}
