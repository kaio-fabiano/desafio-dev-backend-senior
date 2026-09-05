import {
  requestToResourceInput,
  verifyAccessTokenRequest,
} from 'better-auth/oauth2';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toOAuthRequest } from './oauth-request.adapter.ts';
import { OAuthResourceService } from './oauth-resource.service.ts';
import type { OAuthResourceOptions } from '../oauth-resource.types.ts';

vi.mock('better-auth/oauth2', () => ({
  requestToResourceInput: vi.fn((request: Request) => ({
    authorizationHeader: request.headers.get('authorization'),
    method: request.method,
    url: request.url,
  })),
  verifyAccessTokenRequest: vi.fn(),
}));

const options = {
  audience: 'https://gateway.marketplace.local',
  issuer: 'https://identity.marketplace.local/api/auth',
  jwksUrl: 'https://identity.marketplace.local/api/auth/jwks',
} satisfies OAuthResourceOptions;

const verifyAccessToken = vi.mocked(verifyAccessTokenRequest);

describe('OAuthResourceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AC-212: rejects incomplete or malformed local verification configuration @spec:AC-212', () => {
    expect(
      () => new OAuthResourceService({ ...options, audience: '' }),
    ).toThrow('OAuth audience must be a valid URL');
    expect(
      () => new OAuthResourceService({ ...options, issuer: 'identity' }),
    ).toThrow('OAuth issuer must be a valid URL');
    expect(
      () => new OAuthResourceService({ ...options, jwksUrl: 'jwks' }),
    ).toThrow('OAuth JWKS URL must be a valid URL');
    expect(
      () => new OAuthResourceService({ ...options, audience: 'ftp://gateway' }),
    ).toThrow('OAuth audience must be a valid URL');
  });

  it('delegates ES256 verification and maps the authenticated claims', async () => {
    verifyAccessToken.mockResolvedValue({
      aud: [options.audience, 'https://identity.marketplace.local'],
      exp: 2_000_000_000,
      iat: 1_900_000_000,
      iss: options.issuer,
      scope: 'orders:read cart:write',
      sub: 'buyer-1',
    });
    const service = new OAuthResourceService(options);
    const request = new Request('https://gateway.marketplace.local/graphql', {
      headers: { authorization: 'Bearer token' },
      method: 'POST',
    });

    const auth = await service.verify(request);

    expect(auth).toMatchObject({
      audience: [options.audience, 'https://identity.marketplace.local'],
      scopes: ['orders:read', 'cart:write'],
      subject: 'buyer-1',
    });
    expect(requestToResourceInput).toHaveBeenCalledWith(request);
    expect(verifyAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({
        authorizationHeader: 'Bearer token',
        method: 'POST',
        url: request.url,
      }),
      {
        jwksUrl: options.jwksUrl,
        verifyOptions: {
          algorithms: ['ES256'],
          audience: options.audience,
          issuer: options.issuer,
          requiredClaims: ['exp', 'iat', 'sub'],
        },
      },
    );
  });

  it('rejects a verified payload whose subject is not a non-empty string', async () => {
    const service = new OAuthResourceService(options);
    const malformedClaims = { sub: 42 } as unknown as Awaited<
      ReturnType<typeof verifyAccessTokenRequest>
    >;
    verifyAccessToken.mockResolvedValue(malformedClaims);

    await expect(
      service.verify(new Request('https://gateway.marketplace.local/graphql')),
    ).rejects.toThrow('Access token subject must be a non-empty string');

    verifyAccessToken.mockResolvedValue({ sub: '   ' });
    await expect(
      service.verify(new Request('https://gateway.marketplace.local/graphql')),
    ).rejects.toThrow('Access token subject must be a non-empty string');
  });

  it('normalizes a single audience and an absent scope claim', async () => {
    verifyAccessToken.mockResolvedValue({
      aud: options.audience,
      exp: 2_000_000_000,
      iat: 1_900_000_000,
      sub: 'buyer-1',
    });

    await expect(
      new OAuthResourceService(options).verify(
        new Request('https://gateway.marketplace.local/graphql'),
      ),
    ).resolves.toMatchObject({
      audience: [options.audience],
      scopes: [],
      subject: 'buyer-1',
    });

    verifyAccessToken.mockResolvedValue({
      exp: 2_000_000_000,
      iat: 1_900_000_000,
      sub: 'buyer-1',
    });
    await expect(
      new OAuthResourceService(options).verify(
        new Request('https://gateway.marketplace.local/graphql'),
      ),
    ).resolves.toMatchObject({ audience: [] });
  });

  it('rejects a malformed scope returned across the verification boundary', async () => {
    const malformedClaims = { scope: 42, sub: 'buyer-1' } as unknown as Awaited<
      ReturnType<typeof verifyAccessTokenRequest>
    >;
    verifyAccessToken.mockResolvedValue(malformedClaims);

    await expect(
      new OAuthResourceService(options).verify(
        new Request('https://gateway.marketplace.local/graphql'),
      ),
    ).rejects.toThrow('Access token scope must be a string');
  });
});

describe('toOAuthRequest', () => {
  it('AC-214: ignores untrusted forwarded headers @spec:AC-214', () => {
    const request = toOAuthRequest({
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
    const request = toOAuthRequest({ headers: {} });

    expect(request.method).toBe('GET');
    expect(request.url).toBe('http://resource.local/');
  });

  it('accepts array headers and the framework request URL', () => {
    const request = toOAuthRequest({
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
      toOAuthRequest({
        headers: { host: 'api.example.com' },
        protocol: 'ftp',
      }),
    ).toThrow('OAuth request protocol must be HTTP or HTTPS');
    expect(() =>
      toOAuthRequest({
        headers: { host: 'api.example.com' },
        originalUrl: 'https://attacker.example/graphql',
      }),
    ).toThrow('OAuth request target must be an absolute path');
    expect(() =>
      toOAuthRequest({
        headers: { host: 'api.example.com' },
        originalUrl: '//attacker.example/graphql',
      }),
    ).toThrow('OAuth request target must be an absolute path');
  });
});
