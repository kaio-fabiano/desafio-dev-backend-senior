import { APIError } from 'better-auth';
import { describe, expect, it } from 'vitest';

import { OAuthCredentialError } from '../domain/errors/oauth-credential.error.ts';

describe('OAuthCredentialError.isCredential', () => {
  it('classifies typed OAuth and token-validation failures as credentials', () => {
    expect(
      OAuthCredentialError.isCredential(new OAuthCredentialError('invalid')),
    ).toBe(true);
    expect(
      OAuthCredentialError.isCredential(new APIError('UNAUTHORIZED')),
    ).toBe(true);
    for (const code of [
      'ERR_JOSE_ALG_NOT_ALLOWED',
      'ERR_JWS_INVALID',
      'ERR_JWS_SIGNATURE_VERIFICATION_FAILED',
      'ERR_JWT_CLAIM_VALIDATION_FAILED',
      'ERR_JWT_EXPIRED',
      'ERR_JWT_INVALID',
      'ERR_JWKS_NO_MATCHING_KEY',
    ]) {
      expect(OAuthCredentialError.isCredential({ code })).toBe(true);
    }
  });

  it('preserves JWKS provider and unexpected operational failures', () => {
    for (const code of [
      'ERR_JWKS_INVALID',
      'ERR_JWKS_MULTIPLE_MATCHING_KEYS',
      'ERR_JWKS_TIMEOUT',
    ]) {
      expect(OAuthCredentialError.isCredential({ code })).toBe(false);
    }
    expect(
      OAuthCredentialError.isCredential(new Error('JWKS unavailable')),
    ).toBe(false);
    expect(OAuthCredentialError.isCredential(null)).toBe(false);
  });
});
