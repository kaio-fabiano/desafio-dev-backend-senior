import { describe, expect, it, vi } from 'vitest';

import { AuthenticatedDataSource } from './authenticated-data-source.ts';

const context = {
  authorization: 'Bearer access-token',
  principal: {
    audience: ['https://gateway.marketplace.local'],
    scopes: ['marketplace:read'],
    subject: 'buyer-1',
  },
  requestId: 'request-1',
  sessionHeaders: {
    cookie: 'analytics=secret; wp_woocommerce_session_store=session',
    'cart-token': 'cart-token',
    'woocommerce-session': 'Session woo-session',
  },
};

function requestHeaders() {
  const headers = new Headers();
  return { headers, request: { http: { headers } } };
}

describe('AuthenticatedDataSource', () => {
  it('AC-226: makes bearer and commerce forwarding explicit capabilities @spec:AC-226', () => {
    const implicit = new AuthenticatedDataSource({
      url: 'http://identity-subgraph:3001/graphql',
    });
    const implicitRequest = requestHeaders();
    implicit.willSendRequest({
      context,
      request: implicitRequest.request,
    } as never);
    expect(implicitRequest.headers.get('authorization')).toBeNull();
    expect(implicitRequest.headers.get('x-request-id')).toBe('request-1');

    const explicit = new AuthenticatedDataSource({
      capabilities: {
        bearer: true,
        origin: 'http://wordpress',
        requestSession: true,
      },
      url: 'http://wordpress/graphql',
    } as never);
    const explicitRequest = requestHeaders();
    explicit.willSendRequest({
      context,
      request: explicitRequest.request,
    } as never);

    expect(Object.fromEntries(explicitRequest.headers)).toMatchObject({
      authorization: 'Bearer access-token',
      'cart-token': 'cart-token',
      cookie: 'wp_woocommerce_session_store=session',
      origin: 'http://wordpress',
      'woocommerce-session': 'Session woo-session',
      'x-request-id': 'request-1',
    });
  });

  it('forwards correlation IDs without depending on an authenticated subject', () => {
    const source = new AuthenticatedDataSource({
      url: 'http://identity-subgraph:3001/graphql',
    });
    const outgoing = requestHeaders();

    source.willSendRequest({
      context: { requestId: 'anonymous-request' },
      request: outgoing.request,
    } as never);

    expect(outgoing.headers.get('x-request-id')).toBe('anonymous-request');
  });

  it('ignores requests without an Apollo HTTP transport', () => {
    const source = new AuthenticatedDataSource({
      capabilities: { bearer: true, requestSession: true },
      url: 'http://identity-subgraph:3001/graphql',
    });

    expect(() =>
      source.willSendRequest({ context, request: {} } as never),
    ).not.toThrow();
  });

  it('preserves every Set-Cookie value from Apollo response headers', () => {
    const setResponseHeader = vi.fn();
    const source = new AuthenticatedDataSource({
      capabilities: { responseSession: true },
      url: 'http://wordpress/graphql',
    } as never);
    const values = ['first=1; Path=/; HttpOnly', 'second=2; Path=/; Secure'];
    const headers = {
      get: (name: string) => (name === 'set-cookie' ? values.join(', ') : null),
      raw: () => ({ 'set-cookie': values }),
    };

    source.didReceiveResponse({
      context: { ...context, setResponseHeader },
      response: { http: { headers } },
    } as never);

    expect(setResponseHeader).toHaveBeenCalledWith('set-cookie', values);
  });

  it('captures only the response session headers requested by policy', () => {
    const setResponseHeader = vi.fn();
    const source = new AuthenticatedDataSource({
      capabilities: { responseSession: true },
      url: 'http://wordpress/graphql',
    } as never);

    source.didReceiveResponse({
      context: { ...context, setResponseHeader },
      response: {
        http: {
          headers: new Headers({
            'cart-token': 'next-cart',
            'woocommerce-session': 'next-session',
          }),
        },
      },
    } as never);

    expect(setResponseHeader).toHaveBeenCalledWith(
      'woocommerce-session',
      'next-session',
    );
    expect(setResponseHeader).toHaveBeenCalledWith('cart-token', 'next-cart');
  });

  it('supports native and scalar Set-Cookie APIs and disabled capture', () => {
    const setResponseHeader = vi.fn();
    const enabled = new AuthenticatedDataSource({
      capabilities: { responseSession: true },
      url: 'http://wordpress/graphql',
    });
    const disabled = new AuthenticatedDataSource({
      url: 'http://identity/graphql',
    });
    const response = {
      http: { headers: new Headers({ 'set-cookie': 'one=1' }) },
    };

    disabled.didReceiveResponse({ context, response } as never);
    enabled.didReceiveResponse({
      context: { ...context, setResponseHeader },
      response,
    } as never);
    enabled.didReceiveResponse({
      context: { ...context, setResponseHeader },
      response: {
        http: {
          headers: {
            get: () => null,
            getSetCookie: () => ['native=1', 'native=2'],
          },
        },
      },
    } as never);
    enabled.didReceiveResponse({
      context: { ...context, setResponseHeader },
      response: { http: { headers: { get: () => 'scalar=1' } } },
    } as never);

    expect(setResponseHeader).toHaveBeenCalledWith('set-cookie', ['one=1']);
    expect(setResponseHeader).toHaveBeenCalledWith('set-cookie', [
      'native=1',
      'native=2',
    ]);
    expect(setResponseHeader).toHaveBeenCalledWith('set-cookie', ['scalar=1']);
  });

  it('does not forward response session state without transport headers', () => {
    const setResponseHeader = vi.fn();
    const source = new AuthenticatedDataSource({
      capabilities: { responseSession: true },
      url: 'http://wordpress/graphql',
    });

    source.didReceiveResponse({
      context: { ...context, setResponseHeader },
      response: {},
    } as never);
    source.didReceiveResponse({
      context: { ...context, setResponseHeader },
      response: {
        http: {
          headers: {
            get: () => null,
          },
        },
      },
    } as never);

    expect(setResponseHeader).not.toHaveBeenCalled();
  });
});
