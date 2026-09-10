import {
  requestToResourceInput,
  verifyAccessTokenRequest,
} from 'better-auth/oauth2';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { OAuthCredentialVerification } from '../application/dto/oauth-credential-verification.dto.ts';
import { OAuthCredentialVerifierPort } from '../application/ports/oauth-credential-verifier.port.ts';
import { VerifyOAuthCredentialUseCase } from '../application/use-cases/verify-oauth-credential.use-case.ts';
import { OAuthClaims } from '../domain/value-objects/oauth-claims.ts';
import type { OAuthResourceOptions } from '../oauth-resource.types.ts';
import { OAuthRequestAdapter } from './oauth-request.adapter.ts';
import { OAuthResourceService } from './oauth-resource.service.ts';

vi.mock('better-auth/oauth2', () => ({
  requestToResourceInput: vi.fn((request: Request) => ({
    authorizationHeader: request.headers.get('authorization'),
    method: request.method,
    url: request.url,
  })),
  verifyAccessTokenRequest: vi.fn(),
}));

const verifyAccessToken = vi.mocked(verifyAccessTokenRequest);

describe('OAuthResourceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AC-308: delegates request verification to the use case @spec:AC-308', async () => {
    const expected = OAuthClaims.from({
      aud: ['https://gateway.marketplace.local'],
      scope: 'orders:read cart:write',
      sub: 'buyer-1',
    });
    const execute = vi.fn().mockResolvedValue(expected);
    const service = new OAuthResourceService({ execute });
    const request = new Request('https://gateway.marketplace.local/graphql', {
      headers: { authorization: 'Bearer token' },
      method: 'POST',
    });

    const auth = await service.verify(request);

    expect(auth).toBe(expected);
    expect(requestToResourceInput).toHaveBeenCalledWith(request);
    expect(execute).toHaveBeenCalledWith(
      new OAuthCredentialVerification(
        'Bearer token',
        undefined,
        'POST',
        request.url,
      ),
    );
  });

  it('preserves direct option validation through the dedicated adapter', () => {
    const options = {
      audience: 'ftp://gateway',
      issuer: 'https://identity.marketplace.local/api/auth',
      jwksUrl: 'https://identity.marketplace.local/api/auth/jwks',
    } satisfies OAuthResourceOptions;

    expect(() => new OAuthResourceService(options)).toThrow(
      'OAuth audience must be a valid URL',
    );
  });

  it('preserves direct verification through the dedicated adapter', async () => {
    verifyAccessToken.mockResolvedValue({
      aud: 'https://gateway.marketplace.local',
      sub: 'buyer-1',
    });
    const service = new OAuthResourceService({
      audience: 'https://gateway.marketplace.local',
      issuer: 'https://identity.marketplace.local/api/auth',
      jwksUrl: 'https://identity.marketplace.local/api/auth/jwks',
    });

    await expect(
      service.verify(new Request('https://gateway.marketplace.local/graphql')),
    ).resolves.toMatchObject({ subject: 'buyer-1' });
    expect(verifyAccessToken).toHaveBeenCalledOnce();
  });

  it('rejects a verified payload whose subject is not a non-empty string', async () => {
    const verifyCredential = vi.fn().mockResolvedValue({ sub: 42 });
    const service = new OAuthResourceService(
      new VerifyOAuthCredentialUseCase({ verifyCredential }),
    );

    await expect(
      service.verify(new Request('https://gateway.marketplace.local/graphql')),
    ).rejects.toThrow('Access token subject must be a non-empty string');

    verifyCredential.mockResolvedValue({ sub: '   ' });
    await expect(
      service.verify(new Request('https://gateway.marketplace.local/graphql')),
    ).rejects.toThrow('Access token subject must be a non-empty string');
  });

  it('normalizes a single audience and an absent scope claim', async () => {
    const verifyCredential = vi.fn().mockResolvedValue({
      aud: 'https://gateway.marketplace.local',
      sub: 'buyer-1',
    });
    const service = new OAuthResourceService(
      new VerifyOAuthCredentialUseCase({ verifyCredential }),
    );

    await expect(
      service.verify(new Request('https://gateway.marketplace.local/graphql')),
    ).resolves.toMatchObject({
      audience: ['https://gateway.marketplace.local'],
      scopes: [],
      subject: 'buyer-1',
    });

    verifyCredential.mockResolvedValue({ sub: 'buyer-1' });
    await expect(
      service.verify(new Request('https://gateway.marketplace.local/graphql')),
    ).resolves.toMatchObject({ audience: [] });
  });

  it('rejects a malformed scope returned across the verification boundary', async () => {
    const verifier = {
      verifyCredential: vi
        .fn()
        .mockResolvedValue({ scope: 42, sub: 'buyer-1' }),
    } satisfies OAuthCredentialVerifierPort;

    await expect(
      new OAuthResourceService(
        new VerifyOAuthCredentialUseCase(verifier),
      ).verify(new Request('https://gateway.marketplace.local/graphql')),
    ).rejects.toThrow('Access token scope must be a string');
  });
});

describe('OAuthRequestAdapter.toRequest', () => {
  it('AC-214: ignores untrusted forwarded headers @spec:AC-214', () => {
    const request = OAuthRequestAdapter.toRequest({
      headers: {
        authorization: 'DPoP token',
        host: 'internal:3000',
        'x-forwarded-host': 'api.example.com',
        'x-forwarded-proto': 'https',
      },
      method: 'POST',
      originalUrl: '/graphql?operation=checkout',
    });

    expect(request.method).toBe('POST');
    expect(request.url).toBe('http://internal:3000/graphql?operation=checkout');
    expect(request.headers.get('authorization')).toBe('DPoP token');
  });

  it('uses safe defaults for an internal request', () => {
    const request = OAuthRequestAdapter.toRequest({ headers: {} });

    expect(request.method).toBe('GET');
    expect(request.url).toBe('http://resource.local/');
  });

  it('accepts array headers and the framework request URL', () => {
    const request = OAuthRequestAdapter.toRequest({
      headers: {
        host: 'api.example.com',
        'x-empty': undefined,
        'x-values': ['one', 'two'],
      },
      protocol: 'https',
      url: '/graphql',
    });

    expect(request.url).toBe('https://api.example.com/graphql');
    expect(request.headers.get('x-values')).toBe('one, two');
  });

  it('rejects unsupported protocols and absolute request targets', () => {
    expect(() =>
      OAuthRequestAdapter.toRequest({
        headers: { host: 'api.example.com' },
        protocol: 'ftp',
      }),
    ).toThrow('OAuth request protocol must be HTTP or HTTPS');
    expect(() =>
      OAuthRequestAdapter.toRequest({
        headers: { host: 'api.example.com' },
        originalUrl: 'https://attacker.example/graphql',
      }),
    ).toThrow('OAuth request target must be an absolute path');
    expect(() =>
      OAuthRequestAdapter.toRequest({
        headers: { host: 'api.example.com' },
        originalUrl: '//attacker.example/graphql',
      }),
    ).toThrow('OAuth request target must be an absolute path');
  });
});
