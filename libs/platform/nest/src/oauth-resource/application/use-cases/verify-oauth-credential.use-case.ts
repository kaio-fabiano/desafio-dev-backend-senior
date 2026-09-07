import { OAuthClaims } from '../../domain/value-objects/oauth-claims.ts';
import { OAuthCredentialVerification } from '../dto/oauth-credential-verification.dto.ts';
import { OAuthCredentialVerifierPort } from '../ports/oauth-credential-verifier.port.ts';

export class VerifyOAuthCredentialUseCase {
  constructor(private readonly verifier: OAuthCredentialVerifierPort) {}

  async execute(credential: OAuthCredentialVerification): Promise<OAuthClaims> {
    return OAuthClaims.from(await this.verifier.verifyCredential(credential));
  }
}
