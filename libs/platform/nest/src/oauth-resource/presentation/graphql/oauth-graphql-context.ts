import type { OAuthClaims } from '../../domain/value-objects/oauth-claims.ts';
import type { OAuthHttpRequest } from '../../infrastructure/http/oauth-http-request.ts';

export declare class OAuthGraphQLContext {
  auth?: OAuthClaims;
  req?: OAuthHttpRequest;
}
