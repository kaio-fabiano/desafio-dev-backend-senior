import type { OAuthClaims } from './oauth-claims.ts';
import type { OAuthHttpRequest } from './oauth-http-request.ts';

export declare class OAuthGraphQLContext {
  auth?: OAuthClaims;
  req?: OAuthHttpRequest;
}
