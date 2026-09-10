import { Inject, Injectable } from '@nestjs/common';
import { requestToResourceInput } from 'better-auth/oauth2';

import { OAuthCredentialVerification } from '../application/dto/oauth-credential-verification.dto.ts';
import { VerifyOAuthCredentialUseCase } from '../application/use-cases/verify-oauth-credential.use-case.ts';
import { OAuthClaims } from '../domain/value-objects/oauth-claims.ts';
import { BetterAuthOAuthCredentialVerifierAdapter } from '../infrastructure/better-auth-oauth-credential-verifier.adapter.ts';
import type { OAuthResourceOptions } from '../oauth-resource.types.ts';

@Injectable()
export class OAuthResourceService {
  private readonly verification: Pick<VerifyOAuthCredentialUseCase, 'execute'>;

  constructor(
    @Inject(VerifyOAuthCredentialUseCase)
    verification:
      | Pick<VerifyOAuthCredentialUseCase, 'execute'>
      | OAuthResourceOptions,
  ) {
    if ('execute' in verification) {
      this.verification = verification;
      return;
    }
    // ponytail: direct construction still routes verifyAccessTokenRequest through the adapter; remove when all callers use OAuthResourceModule.
    const verifier = new BetterAuthOAuthCredentialVerifierAdapter(verification);
    this.verification = {
      execute: async (credential) =>
        OAuthClaims.from(await verifier.verifyCredential(credential)),
    };
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
}
