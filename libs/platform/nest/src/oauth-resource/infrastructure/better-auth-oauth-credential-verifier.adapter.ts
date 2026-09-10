import { Inject, Injectable } from '@nestjs/common';
import { verifyAccessTokenRequest } from 'better-auth/oauth2';

import { OAuthCredentialVerification } from '../application/dto/oauth-credential-verification.dto.ts';
import { OAuthCredentialVerifierPort } from '../application/ports/oauth-credential-verifier.port.ts';
import { OAuthResourceOptionsToken } from '../oauth-resource.tokens.ts';
import type { OAuthResourceOptions } from '../oauth-resource.types.ts';
import { OAuthResourceVerificationMessages } from './errors/oauth-resource-verification-messages.ts';

@Injectable()
export class BetterAuthOAuthCredentialVerifierAdapter
  implements OAuthCredentialVerifierPort
{
  constructor(
    @Inject(OAuthResourceOptionsToken)
    private readonly options: OAuthResourceOptions,
  ) {
    BetterAuthOAuthCredentialVerifierAdapter.assertHttpUrl(
      options.audience,
      'OAuth audience',
    );
    BetterAuthOAuthCredentialVerifierAdapter.assertHttpUrl(
      options.issuer,
      'OAuth issuer',
    );
    BetterAuthOAuthCredentialVerifierAdapter.assertHttpUrl(
      options.jwksUrl,
      'OAuth JWKS URL',
    );
  }

  async verifyCredential(
    credential: OAuthCredentialVerification,
  ): Promise<Readonly<Record<string, unknown>>> {
    return verifyAccessTokenRequest(credential, {
      ...(this.options.dpop ? { dpop: this.options.dpop } : {}),
      jwksUrl: this.options.jwksUrl,
      verifyOptions: {
        algorithms: ['ES256'],
        audience: this.options.audience,
        issuer: this.options.issuer,
        requiredClaims: ['exp', 'iat', 'sub'],
      },
    });
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
