import { Inject, Injectable } from '@nestjs/common';
import {
  requestToResourceInput,
  verifyAccessTokenRequest,
} from 'better-auth/oauth2';

import type { OAuthClaims } from '../oauth-claims.ts';
import { OAuthResourceOptionsToken as OAUTH_RESOURCE_OPTIONS } from '../oauth-resource.tokens.ts';
import type {
  OAuthResourceOptions,
} from '../oauth-resource.types.ts';
import { OAuthCredentialError } from './oauth-resource.errors.ts';

@Injectable()
export class OAuthResourceService {
  constructor(
    @Inject(OAUTH_RESOURCE_OPTIONS)
    private readonly options: OAuthResourceOptions,
  ) {
    OAuthResourceService.assertHttpUrl(options.audience, 'OAuth audience');
    OAuthResourceService.assertHttpUrl(options.issuer, 'OAuth issuer');
    OAuthResourceService.assertHttpUrl(options.jwksUrl, 'OAuth JWKS URL');
  }

  async verify(request: Request): Promise<OAuthClaims> {
    const claims = await verifyAccessTokenRequest(
      requestToResourceInput(request),
      {
        jwksUrl: this.options.jwksUrl,
        verifyOptions: {
          algorithms: ['ES256'],
          audience: this.options.audience,
          issuer: this.options.issuer,
          requiredClaims: ['exp', 'iat', 'sub'],
        },
      },
    );
    if (typeof claims.sub !== 'string' || claims.sub.trim().length === 0) {
      throw new OAuthCredentialError(
        'Access token subject must be a non-empty string',
      );
    }
    const scope = claims.scope;
    if (scope !== undefined && typeof scope !== 'string') {
      throw new OAuthCredentialError('Access token scope must be a string');
    }
    return {
      audience: Array.isArray(claims.aud)
        ? claims.aud
        : claims.aud
          ? [claims.aud]
          : [],
      claims,
      scopes: (scope ?? '').split(' ').filter(Boolean),
      subject: claims.sub,
    } satisfies OAuthClaims;
  }

  private static assertHttpUrl(value: string, label: string): void {
    try {
      const url = new URL(value);
      if (url.protocol !== 'http:' && url.protocol !== 'https:')
        throw new Error();
    } catch {
      throw new Error(`${label} must be a valid URL`);
    }
  }
}
