import { isAPIError } from 'better-auth/api';

export class OAuthCredentialError extends Error {
  static isCredential(error: unknown): boolean {
    return (
      error instanceof OAuthCredentialError ||
      (isAPIError(error) && error.statusCode === 401) ||
      (typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof error.code === 'string' &&
        OAuthCredentialError.joseCodes.has(error.code))
    );
  }

  private static readonly joseCodes = new Set([
    'ERR_JOSE_ALG_NOT_ALLOWED',
    'ERR_JWS_INVALID',
    'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
    'ERR_JWT_CLAIM_VALIDATION_FAILED',
    'ERR_JWT_EXPIRED',
    'ERR_JWT_INVALID',
    'ERR_JWKS_NO_MATCHING_KEY',
  ]);
}
