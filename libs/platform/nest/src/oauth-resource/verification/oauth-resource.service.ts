import { Inject, Injectable, Optional } from '@nestjs/common';
import {
  requestToResourceInput,
  verifyAccessTokenRequest,
} from 'better-auth/oauth2';

import { OAuthCredentialVerification } from '../application/dto/oauth-credential-verification.dto.ts';
import { OAuthCredentialVerifierPort } from '../application/ports/oauth-credential-verifier.port.ts';
import { VerifyOAuthCredentialUseCase } from '../application/use-cases/verify-oauth-credential.use-case.ts';
import { OAuthCredentialError } from '../domain/errors/oauth-credential.error.ts';
import { OAuthCredentialMessages } from '../domain/errors/oauth-credential-messages.ts';
import { OAuthClaims } from '../domain/value-objects/oauth-claims.ts';
import { OAuthResourceVerificationMessages } from '../infrastructure/errors/oauth-resource-verification-messages.ts';
import { OAuthResourceOptionsToken as OAUTH_RESOURCE_OPTIONS } from '../oauth-resource.tokens.ts';
import type { OAuthResourceOptions } from '../oauth-resource.types.ts';

@Injectable()
export class OAuthResourceService extends OAuthCredentialVerifierPort {
  constructor(
    @Inject(OAUTH_RESOURCE_OPTIONS)
    private readonly options: OAuthResourceOptions,
    @Optional()
    @Inject(VerifyOAuthCredentialUseCase)
    private readonly verification?: VerifyOAuthCredentialUseCase,
  ) {
    super();
    OAuthResourceService.assertHttpUrl(options.audience, 'OAuth audience');
    OAuthResourceService.assertHttpUrl(options.issuer, 'OAuth issuer');
    OAuthResourceService.assertHttpUrl(options.jwksUrl, 'OAuth JWKS URL');
  }

  async verify(request: Request): Promise<OAuthClaims> {
    const input = requestToResourceInput(request);
    const credential = new OAuthCredentialVerification(
      input.authorizationHeader,
      input.dpopProofJwt,
      input.method,
      input.url,
    );
    if (this.verification) return this.verification.execute(credential);
    return OAuthClaims.from(await this.verifyCredential(credential));
  }

  async verifyCredential(
    credential: OAuthCredentialVerification,
  ): Promise<Readonly<Record<string, unknown>>> {
    const claims = await verifyAccessTokenRequest(credential, {
      jwksUrl: this.options.jwksUrl,
      ...(this.options.dpopReplayStore
        ? { dpop: { replayStore: this.options.dpopReplayStore } }
        : {}),
      verifyOptions: {
        algorithms: ['ES256'],
        audience: this.options.audience,
        issuer: this.options.issuer,
        requiredClaims: ['exp', 'iat', 'sub'],
      },
    });
    if (typeof claims.sub !== 'string' || claims.sub.trim().length === 0) {
      throw new OAuthCredentialError(OAuthCredentialMessages.invalidSubject);
    }
    const scope = claims.scope;
    if (scope !== undefined && typeof scope !== 'string') {
      throw new OAuthCredentialError(OAuthCredentialMessages.invalidScope);
    }
    return claims as Readonly<Record<string, unknown>>;
  }

  private static assertHttpUrl(value: string, label: string): void {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new Error(OAuthResourceVerificationMessages.invalidUrl(label));
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(OAuthResourceVerificationMessages.invalidUrl(label));
    }
  }
}
