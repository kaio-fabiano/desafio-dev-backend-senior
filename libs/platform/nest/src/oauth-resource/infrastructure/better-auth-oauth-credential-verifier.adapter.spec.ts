import { verifyAccessTokenRequest } from 'better-auth/oauth2';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OAuthCredentialVerification } from '../application/dto/oauth-credential-verification.dto.ts';
import type { OAuthResourceOptions } from '../oauth-resource.types.ts';
import { BetterAuthOAuthCredentialVerifierAdapter } from './better-auth-oauth-credential-verifier.adapter.ts';

vi.mock('better-auth/oauth2', () => ({
  verifyAccessTokenRequest: vi.fn(),
}));

const options = {
  audience: 'https://gateway.marketplace.local',
  issuer: 'https://identity.marketplace.local/api/auth',
  jwksUrl: 'https://identity.marketplace.local/api/auth/jwks',
} satisfies OAuthResourceOptions;

const credential = new OAuthCredentialVerification(
  'Bearer token',
  null,
  'POST',
  'https://gateway.marketplace.local/graphql',
);
const verifyAccessToken = vi.mocked(verifyAccessTokenRequest);

describe('BetterAuthOAuthCredentialVerifierAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AC-212: rejects incomplete or malformed local verification configuration @spec:AC-212', () => {
    expect(
      () =>
        new BetterAuthOAuthCredentialVerifierAdapter({
          ...options,
          audience: '',
        }),
    ).toThrow('OAuth audience must be a valid URL');
    expect(
      () =>
        new BetterAuthOAuthCredentialVerifierAdapter({
          ...options,
          issuer: 'identity',
        }),
    ).toThrow('OAuth issuer must be a valid URL');
    expect(
      () =>
        new BetterAuthOAuthCredentialVerifierAdapter({
          ...options,
          jwksUrl: 'jwks',
        }),
    ).toThrow('OAuth JWKS URL must be a valid URL');
    expect(
      () =>
        new BetterAuthOAuthCredentialVerifierAdapter({
          ...options,
          audience: 'ftp://gateway',
        }),
    ).toThrow('OAuth audience must be a valid URL');
  });

  it('delegates ES256 verification to Better Auth', async () => {
    const claims = {
      aud: options.audience,
      exp: 2_000_000_000,
      iat: 1_900_000_000,
      iss: options.issuer,
      scope: 'orders:read',
      sub: 'buyer-1',
    };
    verifyAccessToken.mockResolvedValue(claims);

    await expect(
      new BetterAuthOAuthCredentialVerifierAdapter(options).verifyCredential(
        credential,
      ),
    ).resolves.toBe(claims);
    expect(verifyAccessToken).toHaveBeenCalledWith(credential, {
      jwksUrl: options.jwksUrl,
      verifyOptions: {
        algorithms: ['ES256'],
        audience: options.audience,
        issuer: options.issuer,
        requiredClaims: ['exp', 'iat', 'sub'],
      },
    });
  });

  it('AC-306: delegates DPoP replay reservations to the configured shared store @spec:AC-306', async () => {
    const replayStore = { reserve: vi.fn().mockResolvedValue(true) };
    verifyAccessToken.mockResolvedValue({ sub: 'buyer-1' });

    await new BetterAuthOAuthCredentialVerifierAdapter({
      ...options,
      dpop: { replayStore },
    }).verifyCredential(credential);

    expect(verifyAccessToken).toHaveBeenCalledWith(
      credential,
      expect.objectContaining({ dpop: { replayStore } }),
    );
  });
});
