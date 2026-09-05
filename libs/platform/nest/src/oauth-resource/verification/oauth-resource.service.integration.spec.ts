import {
  generateKeyPairSync,
  sign,
  type JsonWebKey,
  type KeyObject,
} from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { OAuthResourceService } from './oauth-resource.service.ts';
import type { OAuthResourceOptions } from '../oauth-resource.types.ts';

const options = {
  audience: 'https://gateway.marketplace.local',
  issuer: 'https://identity.marketplace.local/api/auth',
  jwksUrl: 'https://identity.marketplace.local/test-jwks',
} satisfies OAuthResourceOptions;

type SigningKey = {
  privateKey: KeyObject;
  publicJwk: JsonWebKey;
};

function createSigningKey(kid: string): SigningKey {
  const { privateKey, publicKey } = generateKeyPairSync('ec', {
    namedCurve: 'P-256',
  });
  return {
    privateKey,
    publicJwk: {
      ...publicKey.export({ format: 'jwk' }),
      alg: 'ES256',
      kid,
      use: 'sig',
    },
  };
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function issueToken(
  key: SigningKey,
  kid: string,
  claims: Readonly<Record<string, unknown>> = {},
): string {
  const now = Math.floor(Date.now() / 1_000);
  const encodedHeader = encode({ alg: 'ES256', kid, typ: 'JWT' });
  const encodedPayload = encode({
    aud: options.audience,
    exp: now + 300,
    iat: now,
    iss: options.issuer,
    scope: 'orders:read',
    sub: 'buyer-1',
    ...claims,
  });
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = sign('sha256', Buffer.from(signingInput), {
    dsaEncoding: 'ieee-p1363',
    key: key.privateKey,
  }).toString('base64url');
  return `${signingInput}.${signature}`;
}

function authenticatedRequest(token: string): Request {
  return new Request('https://gateway.marketplace.local/graphql', {
    headers: { authorization: `Bearer ${token}` },
    method: 'POST',
  });
}

describe('OAuthResourceService with real ES256 tokens and JWKS', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('AC-213: verifies signatures and standard claims through Better Auth @spec:AC-213', async () => {
    const key = createSigningKey('key-valid');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ keys: [key.publicJwk] })),
    );
    const service = new OAuthResourceService(options);

    await expect(
      service.verify(authenticatedRequest(issueToken(key, 'key-valid'))),
    ).resolves.toMatchObject({
      scopes: ['orders:read'],
      subject: 'buyer-1',
    });

    const invalidCases = [
      issueToken(key, 'key-valid', { aud: 'https://wrong.example' }),
      issueToken(key, 'key-valid', { iss: 'https://wrong.example' }),
      issueToken(key, 'key-valid', { exp: 1 }),
      issueToken(key, 'key-valid', {
        nbf: Math.floor(Date.now() / 1_000) + 300,
      }),
      issueToken(createSigningKey('key-valid'), 'key-valid'),
    ];
    for (const token of invalidCases) {
      await expect(
        service.verify(authenticatedRequest(token)),
      ).rejects.toThrow();
    }
  });

  it('uses the Better Auth JWKS cache and refreshes it for a rotated kid', async () => {
    const first = createSigningKey('rotation-1');
    const second = createSigningKey('rotation-2');
    let keys = [first.publicJwk];
    const fetchJwks = vi.fn(async () => Response.json({ keys }));
    vi.stubGlobal('fetch', fetchJwks);
    const service = new OAuthResourceService({
      ...options,
      jwksUrl: `${options.jwksUrl}/rotation`,
    });

    await service.verify(authenticatedRequest(issueToken(first, 'rotation-1')));
    await service.verify(authenticatedRequest(issueToken(first, 'rotation-1')));
    expect(fetchJwks).toHaveBeenCalledTimes(1);

    keys = [first.publicJwk, second.publicJwk];
    await service.verify(
      authenticatedRequest(issueToken(second, 'rotation-2')),
    );
    expect(fetchJwks).toHaveBeenCalledTimes(2);
  });
});
