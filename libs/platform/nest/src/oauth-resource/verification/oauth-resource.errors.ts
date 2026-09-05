import { isAPIError } from 'better-auth/api';

export const OAUTH_AUTHENTICATION_MESSAGES = {
  authenticatedSubjectRequired: 'Authenticated subject is required',
  bearerTokenRequired: 'Bearer token required',
  invalidBearerToken: 'Invalid bearer token',
  requiredScopeMissing: 'Required OAuth scope is missing',
} as const;

export class OAuthCredentialError extends Error {}

const JOSE_CREDENTIAL_ERROR_CODES = new Set([
  'ERR_JOSE_ALG_NOT_ALLOWED',
  'ERR_JWS_INVALID',
  'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
  'ERR_JWT_CLAIM_VALIDATION_FAILED',
  'ERR_JWT_EXPIRED',
  'ERR_JWT_INVALID',
  'ERR_JWKS_NO_MATCHING_KEY',
]);

export function isOAuthCredentialError(error: unknown): boolean {
  return (
    error instanceof OAuthCredentialError ||
    (isAPIError(error) && error.statusCode === 401) ||
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string' &&
      JOSE_CREDENTIAL_ERROR_CODES.has(error.code))
  );
}
