import {
  requestToResourceInput,
  verifyAccessTokenRequest,
} from 'better-auth/oauth2';

import type { AuthContext } from './auth-context.ts';

type TokenClaims = {
  sub?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  scope?: string;
  supplierCompanyId?: string;
};

type VerifyOptions = {
  issuer: string;
  audience: string;
  requiredScopes: readonly string[];
  now?: () => number;
  verify?: (request: Request) => Promise<TokenClaims>;
};

export async function verifyGatewayRequest(
  request: Request,
  options: VerifyOptions,
): Promise<AuthContext> {
  const claims = (await (options.verify
    ? options.verify(request)
    : verifyAccessTokenRequest(requestToResourceInput(request), {
        verifyOptions: {
          issuer: options.issuer,
          audience: options.audience,
        },
        requiredScopes: [...options.requiredScopes],
      }))) as TokenClaims;
  const now = (options.now?.() ?? Date.now()) / 1000;
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud ?? ''];
  const scopes = (claims.scope ?? '').split(' ').filter(Boolean);
  const valid =
    claims.sub &&
    claims.iss === options.issuer &&
    audience.includes(options.audience) &&
    typeof claims.exp === 'number' &&
    claims.exp > now &&
    (claims.nbf === undefined || claims.nbf <= now) &&
    options.requiredScopes.every((scope) => scopes.includes(scope));
  if (!valid || !claims.sub) throw new Error('Invalid access token');

  return {
    subject: claims.sub,
    scopes,
    audience,
    supplierCompanyId: claims.supplierCompanyId,
    requestId: request.headers.get('x-request-id') ?? crypto.randomUUID(),
  };
}
