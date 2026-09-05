import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { APIError } from 'better-auth';
import type { ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';

import { AuthContextFactory } from './auth-context.factory.ts';
import { TokenVerifierService } from './token-verifier.service.ts';

const trustedOrigin = 'https://gateway.marketplace.local';

async function factoryWith(
  verify: TokenVerifierService['verify'],
  configuration: { gatewayOrigin?: string } = { gatewayOrigin: trustedOrigin },
) {
  const testingModule = await Test.createTestingModule({
    providers: [
      AuthContextFactory,
      { provide: TokenVerifierService, useValue: { verify } },
      {
        provide: ConfigService,
        useValue: {
          get: (name: string, fallback: string) =>
            name === 'GATEWAY_ORIGIN' ? configuration.gatewayOrigin : fallback,
        },
      },
    ],
  }).compile();

  return testingModule.get(AuthContextFactory);
}

function request(headers: Record<string, string | string[] | undefined> = {}) {
  return {
    headers,
    method: 'POST',
    originalUrl: '/graphql?operation=Cart',
    rawHeaders: Object.entries(headers).flatMap(([name, value]) =>
      Array.isArray(value)
        ? value.flatMap((item) => [name, item])
        : value === undefined
          ? []
          : [name, value],
    ),
    url: '/graphql?operation=Cart',
  };
}

describe('AuthContextFactory', () => {
  it('AC-226: creates a separated principal with trusted request metadata @spec:AC-226', async () => {
    const verify = vi.fn<TokenVerifierService['verify']>().mockResolvedValue({
      audience: ['https://gateway.marketplace.local'],
      scopes: ['cart:write'],
      subject: 'buyer-1',
    } as never);
    const factory = await factoryWith(verify);

    const context = await factory.create(
      request({
        authorization: 'Bearer signed-token',
        host: 'attacker.example',
        'x-request-id': 'request-1',
      }),
    );

    expect(context).toMatchObject({
      authorization: 'Bearer signed-token',
      principal: {
        audience: ['https://gateway.marketplace.local'],
        scopes: ['cart:write'],
        subject: 'buyer-1',
      },
      requestId: 'request-1',
    });
    expect(verify).toHaveBeenCalledOnce();
    expect(verify.mock.calls[0]?.[0].url).toBe(
      `${trustedOrigin}/graphql?operation=Cart`,
    );
  });

  it('allowlists only WooCommerce cart cookies and session headers', async () => {
    const factory = await factoryWith(
      vi.fn<TokenVerifierService['verify']>().mockResolvedValue({
        audience: [],
        scopes: [],
        subject: 'buyer-1',
      } as never),
    );

    const context = await factory.create(
      request({
        authorization: 'Bearer signed-token',
        cookie: [
          'analytics=secret',
          'woocommerce_cart_hash=hash',
          'woocommerce_items_in_cart=2',
          'wp_woocommerce_session_store=session',
          'wordpress_logged_in_secret=identity',
        ].join('; '),
        'cart-token': 'cart-token',
        'woocommerce-session': 'Session woo-session',
      }),
    );

    expect(context.sessionHeaders).toEqual({
      cookie: [
        'woocommerce_cart_hash=hash',
        'woocommerce_items_in_cart=2',
        'wp_woocommerce_session_store=session',
      ].join('; '),
      'cart-token': 'cart-token',
      'woocommerce-session': 'Session woo-session',
    });
  });

  it('maps credential failures to one GraphQL authentication error', async () => {
    const factory = await factoryWith(
      vi
        .fn<TokenVerifierService['verify']>()
        .mockRejectedValue(new APIError('UNAUTHORIZED')),
    );

    await expect(factory.create(request())).rejects.toMatchObject({
      message: 'Unauthorized',
      extensions: {
        code: 'UNAUTHENTICATED',
        http: { status: 401 },
      },
    });
  });

  it('preserves JWKS outages and unexpected verifier failures', async () => {
    const outage = new Error('JWKS unavailable');
    const factory = await factoryWith(
      vi.fn<TokenVerifierService['verify']>().mockRejectedValue(outage),
    );

    await expect(factory.create(request())).rejects.toBe(outage);
  });

  it('uses the default trusted origin and creates a request ID', async () => {
    const verify = vi.fn<TokenVerifierService['verify']>().mockResolvedValue({
      audience: [],
      scopes: [],
      subject: 'buyer-1',
    } as never);
    const factory = await factoryWith(verify, {});

    const context = await factory.create(request());

    expect(verify.mock.calls[0]?.[0].url).toBe(
      `${trustedOrigin}/graphql?operation=Cart`,
    );
    expect(context.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('exposes response header writes without collapsing string arrays', async () => {
    const factory = await factoryWith(
      vi.fn<TokenVerifierService['verify']>().mockResolvedValue({
        audience: [],
        scopes: [],
        subject: 'buyer-1',
      } as never),
    );
    let responseCookies: string[] = [];
    const setHeader = vi.fn(
      (name: string, value: string | number | readonly string[]) => {
        if (name === 'set-cookie') {
          responseCookies = Array.isArray(value) ? [...value] : [String(value)];
        }
        return response as ServerResponse;
      },
    );
    const getHeader = vi.fn<ServerResponse['getHeader']>((name) =>
      name === 'set-cookie' ? responseCookies : undefined,
    );

    const response: Pick<ServerResponse, 'getHeader' | 'setHeader'> = {
      getHeader,
      setHeader,
    };
    const context = await factory.create(request(), response);
    context.setResponseHeader?.('set-cookie', ['first=1', 'second=2']);
    context.setResponseHeader?.('set-cookie', 'third=3');
    context.setResponseHeader?.('cart-token', 'cart');

    expect(setHeader).toHaveBeenCalledWith('set-cookie', [
      'first=1',
      'second=2',
      'third=3',
    ]);
    expect(setHeader).toHaveBeenCalledWith('cart-token', 'cart');

    getHeader.mockReturnValueOnce('existing=1');
    context.setResponseHeader?.('set-cookie', 'fourth=4');
    expect(setHeader).toHaveBeenCalledWith('set-cookie', [
      'existing=1',
      'fourth=4',
    ]);
  });
});
