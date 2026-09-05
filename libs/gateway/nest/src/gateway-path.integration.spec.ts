import {
  generateKeyPairSync,
  sign,
  type JsonWebKey,
  type KeyObject,
} from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';

import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OAuthResourceService } from '@desafio-dev-backend-senior/source/platform-nest';
import { AuthContextFactory } from './auth/auth-context.factory.ts';
import { TokenVerifierService } from './auth/token-verifier.service.ts';
import { AuthenticatedDataSource } from './federation/authenticated-data-source.ts';

const issuer = 'https://identity.marketplace.local/api/auth';
const audience = 'https://gateway.marketplace.local';

type SigningKey = {
  privateKey: KeyObject;
  publicJwk: JsonWebKey;
};

function signingKey(kid: string): SigningKey {
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

function token(
  key: SigningKey,
  kid: string | undefined,
  claims: Readonly<Record<string, unknown>> = {},
  algorithm = 'ES256',
): string {
  const now = Math.floor(Date.now() / 1_000);
  const header = encode({
    alg: algorithm,
    ...(kid ? { kid } : {}),
    typ: 'JWT',
  });
  const payload = encode({
    aud: audience,
    exp: now + 300,
    iat: now,
    iss: issuer,
    scope: 'orders:read cart:write',
    sub: 'buyer-1',
    ...claims,
  });
  const signingInput = `${header}.${payload}`;
  const signature = sign('sha256', Buffer.from(signingInput), {
    dsaEncoding: 'ieee-p1363',
    key: key.privateKey,
  }).toString('base64url');
  return `${signingInput}.${signature}`;
}

function gatewayRequest(accessToken: string) {
  const authorization = `Bearer ${accessToken}`;
  return {
    headers: {
      authorization,
      cookie: 'analytics=secret; wp_woocommerce_session_store=cart-session',
      host: 'attacker.example',
      'x-request-id': 'request-226',
    },
    method: 'POST',
    rawHeaders: [
      'authorization',
      authorization,
      'cookie',
      'analytics=secret; wp_woocommerce_session_store=cart-session',
      'host',
      'attacker.example',
      'x-request-id',
      'request-226',
    ],
    url: '/graphql',
  };
}

async function contextFactory(jwksUrl: string) {
  const testingModule = await Test.createTestingModule({
    providers: [
      {
        provide: OAuthResourceService,
        useValue: new OAuthResourceService({ audience, issuer, jwksUrl }),
      },
      TokenVerifierService,
      AuthContextFactory,
      {
        provide: ConfigService,
        useValue: { get: () => audience },
      },
    ],
  }).compile();
  return testingModule.get(AuthContextFactory);
}

describe('gateway authentication and federation path', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('AC-226: verifies claims, reuses rotated JWKS, and propagates the allowed edge context @spec:AC-226', async () => {
    const first = signingKey('gateway-key-1');
    const second = signingKey('gateway-key-2');
    let keys = [first.publicJwk];
    const fetchJwks = vi.fn(async () => Response.json({ keys }));
    vi.stubGlobal('fetch', fetchJwks);
    const factory = await contextFactory(
      `https://identity.marketplace.local/jwks/${Date.now()}`,
    );
    const responseHeaders = new Map<string, string | string[]>();
    const response = {
      getHeader: (name: string) => responseHeaders.get(name),
      setHeader: (name: string, value: string | string[]) => {
        responseHeaders.set(name, value);
      },
    };

    const firstContext = await factory.create(
      gatewayRequest(token(first, 'gateway-key-1')),
      response as never,
    );
    await factory.create(gatewayRequest(token(first, 'gateway-key-1')));
    expect(fetchJwks).toHaveBeenCalledTimes(1);

    keys = [first.publicJwk, second.publicJwk];
    const rotatedContext = await factory.create(
      gatewayRequest(token(second, 'gateway-key-2')),
    );
    expect(fetchJwks).toHaveBeenCalledTimes(2);
    expect(rotatedContext.principal).toMatchObject({
      audience: [audience],
      scopes: ['orders:read', 'cart:write'],
      subject: 'buyer-1',
    });

    const received: Record<string, string | undefined> = {};
    const subgraph = createServer((request, subgraphResponse) => {
      received.authorization = request.headers.authorization;
      received.cookie = request.headers.cookie;
      received.origin = request.headers.origin;
      received.requestId = request.headers['x-request-id']?.toString();
      subgraphResponse.setHeader('content-type', 'application/json');
      subgraphResponse.setHeader('set-cookie', ['first=1', 'second=2']);
      subgraphResponse.setHeader('cart-token', 'next-cart');
      subgraphResponse.end(JSON.stringify({ data: { value: 'ok' } }));
    });
    subgraph.listen(0, '127.0.0.1');
    await once(subgraph, 'listening');
    const address = subgraph.address();
    if (!address || typeof address === 'string') {
      throw new Error('Subgraph did not bind');
    }
    const url = `http://127.0.0.1:${address.port}/graphql`;
    try {
      const source = new AuthenticatedDataSource({
        capabilities: {
          bearer: true,
          origin: new URL(url).origin,
          requestSession: true,
          responseSession: true,
        },
        url,
      });

      await expect(
        source.process({
          context: firstContext,
          request: { query: 'query { value }' },
        } as never),
      ).resolves.toMatchObject({ data: { value: 'ok' } });
    } finally {
      subgraph.close();
      await once(subgraph, 'close');
    }

    expect(received).toEqual({
      authorization: expect.stringMatching(/^Bearer /),
      cookie: 'wp_woocommerce_session_store=cart-session',
      origin: new URL(url).origin,
      requestId: 'request-226',
    });
    expect(responseHeaders.get('set-cookie')).toEqual(['first=1', 'second=2']);
    expect(responseHeaders.get('cart-token')).toBe('next-cart');

    const invalidTokens = [
      token(first, 'gateway-key-1', { aud: 'https://wrong.example' }),
      token(first, 'gateway-key-1', { iss: 'https://wrong.example' }),
      token(first, 'gateway-key-1', { exp: 1 }),
      token(first, 'gateway-key-1', {
        nbf: Math.floor(Date.now() / 1_000) + 300,
      }),
      token(first, 'unknown-key'),
      token(first, undefined),
      token(first, 'gateway-key-1', {}, 'ES384'),
    ];
    for (const invalid of invalidTokens) {
      await expect(
        factory.create(gatewayRequest(invalid)),
      ).rejects.toMatchObject({ extensions: { code: 'UNAUTHENTICATED' } });
    }
    await expect(
      factory.create({
        headers: {},
        method: 'POST',
        rawHeaders: [],
        url: '/graphql',
      }),
    ).rejects.toMatchObject({ extensions: { code: 'UNAUTHENTICATED' } });
  });

  it('preserves an unavailable JWKS service as an operational failure', async () => {
    const outage = new Error('JWKS unavailable');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(outage));
    const factory = await contextFactory(
      `https://identity.marketplace.local/outage/${Date.now()}`,
    );
    const key = signingKey('outage-key');

    await expect(
      factory.create(gatewayRequest(token(key, 'outage-key'))),
    ).rejects.toBe(outage);
  });
});
