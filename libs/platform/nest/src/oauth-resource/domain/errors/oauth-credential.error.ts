export class OAuthCredentialError extends Error {
  private static readonly joseCodes = new Set([
    'ERR_JOSE_ALG_NOT_ALLOWED',
    'ERR_JWS_INVALID',
    'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
    'ERR_JWT_CLAIM_VALIDATION_FAILED',
    'ERR_JWT_EXPIRED',
    'ERR_JWT_INVALID',
    'ERR_JWKS_NO_MATCHING_KEY',
  ]);

  static isCredential(error: unknown): boolean {
    return (
      error instanceof OAuthCredentialError ||
      (typeof error === 'object' &&
        error !== null &&
        (('statusCode' in error && error.statusCode === 401) ||
          ('code' in error &&
            typeof error.code === 'string' &&
            OAuthCredentialError.joseCodes.has(error.code))))
    );
  }
}
