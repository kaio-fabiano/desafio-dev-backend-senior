import { Inject, Injectable } from '@nestjs/common';
import {
  requestToResourceInput,
  verifyAccessTokenRequest,
} from 'better-auth/oauth2';

import { OAuthCredentialVerification } from '../application/dto/oauth-credential-verification.dto.ts';
import { OAuthCredentialVerifierPort } from '../application/ports/oauth-credential-verifier.port.ts';
import { VerifyOAuthCredentialUseCase } from '../application/use-cases/verify-oauth-credential.use-case.ts';
import { OAuthCredentialError } from '../domain/errors/oauth-credential.error.ts';
import type { OAuthClaims } from '../domain/value-objects/oauth-claims.ts';
import { OAuthResourceOptionsToken as OAUTH_RESOURCE_OPTIONS } from '../oauth-resource.tokens.ts';
import type { OAuthResourceOptions } from '../oauth-resource.types.ts';

@Injectable()
export class OAuthResourceService extends OAuthCredentialVerifierPort {
  private readonly verification: VerifyOAuthCredentialUseCase;

  constructor(
    @Inject(OAUTH_RESOURCE_OPTIONS)
    private readonly options: OAuthResourceOptions,
  ) {
    super();
    OAuthResourceService.assertHttpUrl(options.audience, 'OAuth audience');
    OAuthResourceService.assertHttpUrl(options.issuer, 'OAuth issuer');
    OAuthResourceService.assertHttpUrl(options.jwksUrl, 'OAuth JWKS URL');
    this.verification = new VerifyOAuthCredentialUseCase(this);
  }

  async verify(request: Request): Promise<OAuthClaims> {
    const input = requestToResourceInput(request);
    return this.verification.execute(
      new OAuthCredentialVerification(
        input.authorizationHeader,
        input.dpopProofJwt,
        input.method,
        input.url,
      ),
    );
  }

  async verifyCredential(
    credential: OAuthCredentialVerification,
  ): Promise<Readonly<Record<string, unknown>>> {
    const claims = await verifyAccessTokenRequest(credential, {
      jwksUrl: this.options.jwksUrl,
      verifyOptions: {
        algorithms: ['ES256'],
        audience: this.options.audience,
        issuer: this.options.issuer,
        requiredClaims: ['exp', 'iat', 'sub'],
      },
    });
    if (typeof claims.sub !== 'string' || claims.sub.trim().length === 0) {
      throw new OAuthCredentialError(
        'Access token subject must be a non-empty string',
      );
    }
    const scope = claims.scope;
    if (scope !== undefined && typeof scope !== 'string') {
      throw new OAuthCredentialError('Access token scope must be a string');
    }
    return claims as Readonly<Record<string, unknown>>;
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
