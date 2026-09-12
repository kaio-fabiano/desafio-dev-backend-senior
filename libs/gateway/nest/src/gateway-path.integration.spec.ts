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
import { CommerceCookiePort } from './application/ports/commerce-cookie.port.ts';
import { GatewayTokenVerifierPort } from './application/ports/gateway-token-verifier.port.ts';
import { CaptureFederationResponseUseCase } from './application/use-cases/capture-federation-response.use-case.ts';
import { CreateGatewayContextUseCase } from './application/use-cases/create-gateway-context.use-case.ts';
import { PrepareFederationRequestUseCase } from './application/use-cases/prepare-federation-request.use-case.ts';
import { AuthContextFactory } from './auth/auth-context.factory.ts';
import { TokenVerifierService } from './auth/token-verifier.service.ts';
import { AuthenticatedDataSource } from './federation/authenticated-data-source.ts';
import { GatewayFederationConfiguration } from './federation/gateway-federation.configuration.ts';
import { GatewayFederationModule } from './federation/gateway-federation.module.ts';
import { CommerceCookieAdapter } from './infrastructure/http/commerce-cookie.adapter.ts';

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

function gatewayRequest(
  accessToken: string,
  sessionHeaders: Readonly<{
    'cart-token'?: string;
    'woocommerce-session'?: string;
  }> = {},
) {
  const authorization = `Bearer ${accessToken}`;
  const headers = {
    authorization,
    cookie: 'analytics=secret; wp_woocommerce_session_store=cart-session',
    host: 'attacker.example',
    'x-request-id': 'request-226',
    ...sessionHeaders,
  };
  return {
    headers,
    method: 'POST',
    rawHeaders: Object.entries(headers).flat(),
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
      {
        provide: GatewayTokenVerifierPort,
        useExisting: TokenVerifierService,
      },
      CommerceCookieAdapter,
      {
        provide: CommerceCookiePort,
        useExisting: CommerceCookieAdapter,
      },
      CreateGatewayContextUseCase,
      AuthContextFactory,
      {
        provide: ConfigService,
        useValue: { get: () => audience },
      },
    ],
  }).compile();
  return testingModule.get(AuthContextFactory);
}

async function wordpressDataSource(url: string) {
  const testingModule = await Test.createTestingModule({
    imports: [GatewayFederationModule],
  })
    .overrideProvider(ConfigService)
    .useValue({
      get: (name: string, fallback?: string) =>
        ({
          WORDPRESS_GRAPHQL_URL: url,
          WPGRAPHQL_SITE_TOKEN: 'site-token',
        })[name] ?? fallback,
    })
    .compile();
  return {
    close: () => testingModule.close(),
    createSource: (name: string, sourceUrl: string) =>
      new AuthenticatedDataSource(
        {
          capabilities: GatewayFederationConfiguration.capabilities(
            name,
            sourceUrl,
          ),
          url: sourceUrl,
        },
        testingModule.get(PrepareFederationRequestUseCase),
        testingModule.get(CaptureFederationResponseUseCase),
      ),
    source: new AuthenticatedDataSource(
      {
        capabilities: GatewayFederationConfiguration.capabilities(
          'wordpress',
          url,
        ),
        url,
      },
      testingModule.get(PrepareFederationRequestUseCase),
      testingModule.get(CaptureFederationResponseUseCase),
    ),
  };
}

function wordpressContext(subject: string) {
  return {
    authorization: `Bearer oauth-${subject}`,
    principal: { audience: [audience], scopes: ['cart:write'], subject },
    requestId: `request-${subject}`,
    sessionHeaders: {},
    setResponseHeader: vi.fn(),
  };
}

async function wordpressFixture() {
  const carts = new Map<string, boolean>();
  const identities: string[] = [];
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    const operation = JSON.parse(body) as {
      query: string;
      variables?: { input?: { identity?: string } };
    };
    response.setHeader('content-type', 'application/json');

    if (operation.query.includes('LoginGatewayWordPressUser')) {
      const identity = operation.variables?.input?.identity;
      if (
        request.headers['x-wpgraphql-site-token'] !== 'site-token' ||
        !identity
      ) {
        response.end(JSON.stringify({ errors: [{ message: 'Unauthorized' }] }));
        return;
      }
      identities.push(identity);
      response.end(
        JSON.stringify({
          data: { login: { authToken: `wordpress-${identity}` } },
        }),
      );
      return;
    }

    const subject = request.headers.authorization?.replace(
      /^Bearer wordpress-/,
      '',
    );
    if (!subject || subject === request.headers.authorization) {
      response.end(JSON.stringify({ errors: [{ message: 'Unauthorized' }] }));
      return;
    }
    if (operation.query.includes('addToCart')) carts.set(subject, true);
    response.setHeader('cart-token', 'must-stay-server-side');
    response.end(
      JSON.stringify({
        data: {
          cart: {
            contents: {
              nodes: carts.has(subject) ? [{ key: 'product-1' }] : [],
            },
          },
        },
      }),
    );
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('WordPress fixture did not bind');
  }
  return {
    close: async () => {
      server.close();
      await once(server, 'close');
    },
    identities,
    url: `http://127.0.0.1:${address.port}/graphql`,
  };
}

async function cartRequest(
  source: AuthenticatedDataSource,
  context: ReturnType<typeof wordpressContext>,
  query: string,
) {
  return source.process({ context, request: { query } } as never);
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
      const source = new AuthenticatedDataSource(
        {
          capabilities: {
            bearer: true,
            origin: new URL(url).origin,
            requestSession: true,
            responseSession: true,
          },
          url,
        },
        new PrepareFederationRequestUseCase(new CommerceCookieAdapter(), {
          exchange: async (subject) => `wordpress-${subject}`,
        }),
        new CaptureFederationResponseUseCase(),
      );

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

  it('AC-357: restores the same native cart from the verified OAuth subject @spec:AC-357', async () => {
    const wordpress = await wordpressFixture();
    const gateway = await wordpressDataSource(wordpress.url);
    const context = wordpressContext('buyer-1');

    try {
      await cartRequest(
        gateway.source,
        context,
        'mutation Add { addToCart(input: { productId: 1001 }) { cart { contents { nodes { key } } } } }',
      );
      const result = await cartRequest(
        gateway.source,
        context,
        'query Cart { cart { contents { nodes { key } } } }',
      );

      expect(result.data).toEqual({
        cart: { contents: { nodes: [{ key: 'product-1' }] } },
      });
      expect(wordpress.identities).toEqual(['buyer-1', 'buyer-1']);
      expect(context.setResponseHeader).toHaveBeenCalledWith(
        'cart-token',
        'must-stay-server-side',
      );
    } finally {
      await gateway.close();
      await wordpress.close();
    }
  });

  it('AC-358: isolates native carts by verified OAuth subject @spec:AC-358', async () => {
    const wordpress = await wordpressFixture();
    const gateway = await wordpressDataSource(wordpress.url);
    const buyerOne = wordpressContext('buyer-1');
    const buyerTwo = wordpressContext('buyer-2');

    try {
      await cartRequest(
        gateway.source,
        buyerOne,
        'mutation Add { addToCart(input: { productId: 1001 }) { cart { contents { nodes { key } } } } }',
      );
      const [ownerCart, otherCart] = await Promise.all([
        cartRequest(
          gateway.source,
          buyerOne,
          'query OwnerCart { cart { contents { nodes { key } } } }',
        ),
        cartRequest(
          gateway.source,
          buyerTwo,
          'query OtherCart { cart { contents { nodes { key } } } }',
        ),
      ]);

      expect(ownerCart.data).toEqual({
        cart: { contents: { nodes: [{ key: 'product-1' }] } },
      });
      expect(otherCart.data).toEqual({ cart: { contents: { nodes: [] } } });
    } finally {
      await gateway.close();
      await wordpress.close();
    }
  });

  it('keeps one public bearer and reuses WordPress commerce headers across federation @spec:AC-361 @spec:AC-362', async () => {
    const key = signingKey('commerce-key');
    const jwksUrl = `https://identity.marketplace.local/jwks/commerce-${Date.now()}`;
    const wordpressUrl = 'https://wordpress.marketplace.local/graphql';
    const wordpressExchanges: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async (
          input: Parameters<typeof fetch>[0],
          init?: Parameters<typeof fetch>[1],
        ) => {
          if (input.toString() === jwksUrl) {
            return Response.json({ keys: [key.publicJwk] });
          }
          if (input.toString() === wordpressUrl) {
            const body = JSON.parse(init?.body?.toString() ?? '{}') as {
              variables?: { input?: { identity?: string } };
            };
            const identity = body.variables?.input?.identity;
            if (identity) wordpressExchanges.push(identity);
            return Response.json({
              data: { login: { authToken: `wordpress-${identity}` } },
            });
          }
          throw new Error(`Unexpected fetch: ${input.toString()}`);
        },
      ),
    );
    const accessToken = token(key, 'commerce-key');
    const factory = await contextFactory(jwksUrl);
    const gateway = await wordpressDataSource(wordpressUrl);
    const responseHeaders = new Map<string, string | string[]>();
    const response = {
      getHeader: (name: string) => responseHeaders.get(name),
      setHeader: (name: string, value: string | string[]) => {
        responseHeaders.set(name, value);
      },
    };

    try {
      const firstContext = await factory.create(
        gatewayRequest(accessToken),
        response as never,
      );
      const firstWordpressHeaders = new Headers();
      await gateway.source.willSendRequest({
        context: firstContext,
        request: { http: { headers: firstWordpressHeaders } },
      } as never);
      gateway.source.didReceiveResponse({
        context: firstContext,
        response: {
          http: {
            headers: new Headers({
              'cart-token': 'cart-buyer-1',
              'woocommerce-session': 'Session woo-buyer-1',
            }),
          },
        },
      } as never);

      expect(responseHeaders).toEqual(
        new Map([
          ['woocommerce-session', 'Session woo-buyer-1'],
          ['cart-token', 'cart-buyer-1'],
        ]),
      );

      const nextContext = await factory.create(
        gatewayRequest(accessToken, {
          'cart-token': responseHeaders.get('cart-token') as string,
          'woocommerce-session': responseHeaders.get(
            'woocommerce-session',
          ) as string,
        }),
      );
      const nextWordpressHeaders = new Headers();
      await gateway.source.willSendRequest({
        context: nextContext,
        request: { http: { headers: nextWordpressHeaders } },
      } as never);
      const workflowHeaders = new Headers();
      await gateway
        .createSource('order-workflow', 'https://workflow.marketplace.local')
        .willSendRequest({
          context: nextContext,
          request: { http: { headers: workflowHeaders } },
        } as never);

      expect(wordpressExchanges).toEqual(['buyer-1', 'buyer-1']);
      expect(firstWordpressHeaders.get('authorization')).toBe(
        'Bearer wordpress-buyer-1',
      );
      expect(Object.fromEntries(nextWordpressHeaders)).toMatchObject({
        authorization: 'Bearer wordpress-buyer-1',
        'cart-token': 'cart-buyer-1',
        'woocommerce-session': 'Session woo-buyer-1',
      });
      expect(Object.fromEntries(workflowHeaders)).toMatchObject({
        authorization: `Bearer ${accessToken}`,
        'cart-token': 'cart-buyer-1',
        'woocommerce-session': 'Session woo-buyer-1',
      });
    } finally {
      await gateway.close();
    }
  });
});
