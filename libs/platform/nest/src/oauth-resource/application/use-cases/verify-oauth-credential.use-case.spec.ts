import { describe, expect, it, vi } from 'vitest';

import { OAuthCredentialError } from '../../domain/errors/oauth-credential.error.ts';
import { OAuthCredentialVerification } from '../dto/oauth-credential-verification.dto.ts';
import { OAuthCredentialVerifierPort } from '../ports/oauth-credential-verifier.port.ts';
import { VerifyOAuthCredentialUseCase } from './verify-oauth-credential.use-case.ts';

describe('VerifyOAuthCredentialUseCase', () => {
  const credential = new OAuthCredentialVerification(
    'Bearer token',
    null,
    'POST',
    'https://gateway.marketplace.local/graphql',
  );

  it('AC-256/AC-257: verifies through an abstract port and returns focused claims @spec:AC-256 @spec:AC-257', async () => {
    const verifyCredential = vi.fn().mockResolvedValue({
      aud: ['gateway', 42, 'identity'],
      scope: 'orders:read cart:write',
      sub: 'buyer-1',
    });
    const verifier = { verifyCredential } satisfies OAuthCredentialVerifierPort;

    await expect(
      new VerifyOAuthCredentialUseCase(verifier).execute(credential),
    ).resolves.toMatchObject({
      audience: ['gateway', 'identity'],
      scopes: ['orders:read', 'cart:write'],
      subject: 'buyer-1',
    });
    expect(verifyCredential).toHaveBeenCalledWith(credential);
  });

  it('AC-268: preserves fail-closed claim validation during extraction @spec:AC-268', async () => {
    for (const claims of [
      { sub: 42 },
      { sub: '   ' },
      { scope: 42, sub: 'buyer-1' },
    ]) {
      const verifier = {
        verifyCredential: vi.fn().mockResolvedValue(claims),
      } satisfies OAuthCredentialVerifierPort;

      await expect(
        new VerifyOAuthCredentialUseCase(verifier).execute(credential),
      ).rejects.toBeInstanceOf(OAuthCredentialError);
    }
  });
});
