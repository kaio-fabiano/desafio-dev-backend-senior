import { Inject, Injectable } from '@nestjs/common';
import {
  requestToResourceInput,
  verifyAccessTokenRequest,
} from 'better-auth/oauth2';

export const OAUTH_RESOURCE_OPTIONS = Symbol('OAUTH_RESOURCE_OPTIONS');

export type OAuthResourceOptions = {
  audience: string;
  issuer: string;
  jwksUrl?: string;
};

export type OAuthClaims = {
  audience: readonly string[];
  claims: Readonly<Record<string, unknown>>;
  scopes: readonly string[];
  subject: string;
};

type AccessTokenClaims = Record<string, unknown> & {
  aud?: string | string[];
  scope?: string;
  sub?: string;
};

export class OAuthResourceService {
  constructor(
    private readonly options: OAuthResourceOptions,
  ) {}

  async verify(request: Request): Promise<OAuthClaims> {
    const claims = (await verifyAccessTokenRequest(
      requestToResourceInput(request),
      {
        jwksUrl: this.options.jwksUrl,
        verifyOptions: {
          audience: this.options.audience,
          issuer: this.options.issuer,
        },
      },
    )) as AccessTokenClaims;
    if (!claims.sub) throw new Error('Access token subject is required');
    return {
      audience: Array.isArray(claims.aud)
        ? claims.aud
        : claims.aud
          ? [claims.aud]
          : [],
      claims,
      scopes: (claims.scope ?? '').split(' ').filter(Boolean),
      subject: claims.sub,
    } satisfies OAuthClaims;
  }
}

Injectable()(OAuthResourceService);
Inject(OAUTH_RESOURCE_OPTIONS)(OAuthResourceService, undefined, 0);

export type OAuthHttpRequest = {
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  originalUrl?: string;
  protocol?: string;
  url?: string;
};

export function toOAuthRequest(request: OAuthHttpRequest): Request {
  const headers = new Headers();
  for (const [name, raw] of Object.entries(request.headers)) {
    for (const value of Array.isArray(raw) ? raw : raw ? [raw] : []) {
      headers.append(name, value);
    }
  }
  const forwardedProtocol = firstHeader(request.headers['x-forwarded-proto']);
  const forwardedHost = firstHeader(request.headers['x-forwarded-host']);
  const protocol = forwardedProtocol ?? request.protocol ?? 'http';
  const host = forwardedHost ?? firstHeader(request.headers.host) ?? 'resource.local';
  const url = new URL(request.originalUrl ?? request.url ?? '/', `${protocol}://${host}`);
  return new Request(url, { headers, method: request.method ?? 'GET' });
}

function firstHeader(value: string | string[] | undefined) {
  const first = Array.isArray(value) ? value[0] : value?.split(',')[0];
  return first?.trim() || undefined;
}
