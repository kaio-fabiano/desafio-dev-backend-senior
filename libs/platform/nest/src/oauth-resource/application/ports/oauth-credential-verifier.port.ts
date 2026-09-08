import { OAuthCredentialVerification } from '../dto/oauth-credential-verification.dto.ts';

export abstract class OAuthCredentialVerifierPort {
  abstract verifyCredential(
    credential: OAuthCredentialVerification,
  ): Promise<Readonly<Record<string, unknown>>>;
}
