import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  requestToResourceInput,
  verifyAccessTokenRequest,
} from 'better-auth/oauth2';

import type { AuthContext } from './auth-context.factory.ts';

type TokenClaims = {
  sub?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  nbf?: number;
  scope?: string;
  supplierCompanyId?: string;
};

export type VerifyOptions = {
  issuer: string;
  jwksUrl?: string;
  audience: string;
  requiredScopes: readonly string[];
  now?: () => number;
  verify?: (request: Request) => Promise<TokenClaims>;
};

export type VerifyGatewayRequest = (
  request: Request,
  options: VerifyOptions,
) => Promise<AuthContext>;

export const GATEWAY_TOKEN_OPTIONS = Symbol('GATEWAY_TOKEN_OPTIONS');

export function gatewayTokenOptions(
  environment: NodeJS.ProcessEnv = process.env,
): VerifyOptions {
  return {
    issuer:
      environment.OAUTH_ISSUER ?? 'http://identity-subgraph:3001/api/auth',
    jwksUrl:
      environment.IDENTITY_JWKS_URL ??
      'http://identity-subgraph:3001/api/auth/jwks',
    audience:
      environment.GATEWAY_AUDIENCE ?? 'https://gateway.marketplace.local',
    requiredScopes: [],
  };
}

export const verifyGatewayRequest: VerifyGatewayRequest = async (
  request,
  options,
) => {
  const claims = (await (options.verify
    ? options.verify(request)
    : verifyAccessTokenRequest(requestToResourceInput(request), {
        jwksUrl: options.jwksUrl,
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
    requestId: request.headers.get('x-request-id') ?? randomUUID(),
  };
};

export class TokenVerifierService {
  constructor(private readonly options: VerifyOptions) {}

  verify(request: Request): Promise<AuthContext> {
    return verifyGatewayRequest(request, this.options);
  }
}

Injectable()(TokenVerifierService);
Inject(GATEWAY_TOKEN_OPTIONS)(TokenVerifierService, undefined, 0);
