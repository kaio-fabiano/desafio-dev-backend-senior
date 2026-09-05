import { APIError } from 'better-auth';
import { describe, expect, it } from 'vitest';

import {
  isOAuthCredentialError,
  OAuthCredentialError,
} from './oauth-resource.errors.ts';

describe('isOAuthCredentialError', () => {
  it('classifies typed OAuth and token-validation failures as credentials', () => {
    expect(isOAuthCredentialError(new OAuthCredentialError('invalid'))).toBe(
      true,
    );
    expect(isOAuthCredentialError(new APIError('UNAUTHORIZED'))).toBe(true);
    for (const code of [
      'ERR_JOSE_ALG_NOT_ALLOWED',
      'ERR_JWS_INVALID',
      'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
      'ERR_JWT_CLAIM_VALIDATION_FAILED',
      'ERR_JWT_EXPIRED',
      'ERR_JWT_INVALID',
      'ERR_JWKS_NO_MATCHING_KEY',
    ]) {
      expect(isOAuthCredentialError({ code })).toBe(true);
    }
  });

  it('preserves JWKS provider and unexpected operational failures', () => {
    for (const code of [
      'ERR_JWKS_INVALID',
      'ERR_JWKS_MULTIPLE_MATCHING_KEYS',
      'ERR_JWKS_TIMEOUT',
    ]) {
      expect(isOAuthCredentialError({ code })).toBe(false);
    }
    expect(isOAuthCredentialError(new Error('JWKS unavailable'))).toBe(false);
    expect(isOAuthCredentialError(null)).toBe(false);
  });
});
