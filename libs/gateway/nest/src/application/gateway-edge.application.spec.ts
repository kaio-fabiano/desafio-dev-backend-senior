import { describe, expect, it, vi } from 'vitest';

import { GatewayAuthenticationRequest } from './dto/gateway-authentication-request.dto.ts';
import { GatewayContext } from './dto/gateway-context.dto.ts';
import { CaptureFederationResponseUseCase } from './use-cases/capture-federation-response.use-case.ts';
import { CreateGatewayContextUseCase } from './use-cases/create-gateway-context.use-case.ts';
import { ForwardGatewaySubscriptionUseCase } from './use-cases/forward-gateway-subscription.use-case.ts';
import { PrepareFederationRequestUseCase } from './use-cases/prepare-federation-request.use-case.ts';

// T-220 implementation record: Edge owns authentication, federation, and SSE
// orchestration without an aggregate. Request/connection lifetime is the
// consistency boundary; token, cookie, and subscription ports isolate adapters.
describe('Gateway application orchestration', () => {
  it('creates an authenticated edge context through abstract ports @spec:AC-256', async () => {
    const verifyToken = vi.fn().mockResolvedValue({
      audience: ['gateway'],
      scopes: ['marketplace:read'],
      subject: 'buyer-1',
    });
    const allowlisted = vi
      .fn()
      .mockReturnValue('wp_woocommerce_session_store=session');
    const useCase = new CreateGatewayContextUseCase(
      { verifyToken },
      { allowlisted },
    );
    const request = new GatewayAuthenticationRequest(
      'Bearer access-token',
      ' cart-token ',
      'analytics=secret; wp_woocommerce_session_store=session',
      'signed-dpop-proof',
      'POST',
      'request-1',
      'https://gateway.test/graphql',
      ' Session session-token ',
    );

    await expect(useCase.execute(request)).resolves.toMatchObject({
      authorization: 'Bearer access-token',
      principal: { subject: 'buyer-1' },
      requestId: 'request-1',
      sessionHeaders: {
        cookie: 'wp_woocommerce_session_store=session',
        'cart-token': 'cart-token',
        'woocommerce-session': 'Session session-token',
      },
    });
    expect(verifyToken).toHaveBeenCalledWith(request);
    expect(allowlisted).toHaveBeenCalledWith(
      'analytics=secret; wp_woocommerce_session_store=session',
    );
  });

  it('prepares and captures only capabilities granted to a federated adapter @spec:AC-265', () => {
    const context = new GatewayContext(
      'Bearer access-token',
      { audience: ['gateway'], scopes: [], subject: 'buyer-1' },
      'request-1',
      {
        cookie: 'analytics=secret; wp_woocommerce_session_store=session',
        'cart-token': 'cart-token',
        'woocommerce-session': 'session-token',
      },
    );
    const prepare = new PrepareFederationRequestUseCase({
      allowlisted: () => 'wp_woocommerce_session_store=session',
    });
    const capture = new CaptureFederationResponseUseCase();

    expect(
      Object.fromEntries(
        prepare.execute(
          { bearer: true, origin: 'http://wordpress', requestSession: true },
          context,
        ),
      ),
    ).toEqual({
      authorization: 'Bearer access-token',
      'cart-token': 'cart-token',
      cookie: 'wp_woocommerce_session_store=session',
      origin: 'http://wordpress',
      'woocommerce-session': 'session-token',
      'x-request-id': 'request-1',
    });
    expect(
      Object.fromEntries(
        capture.execute(
          { responseSession: true },
          new Map<string, string | readonly string[]>([
            ['cart-token', 'next-cart'],
            ['set-cookie', ['first=1', 'second=2']],
          ]),
        ),
      ),
    ).toEqual({
      'cart-token': 'next-cart',
      'set-cookie': ['first=1', 'second=2'],
    });
    expect(capture.execute({}, new Map()).size).toBe(0);
  });

  it('forwards subscriptions only through the public client port @spec:AC-268 @principle:P-003', async () => {
    async function* results() {
      yield { data: { orderStatusChanged: { status: 'PAID' } } };
    }
    const subscribe = vi.fn(() => results());
    const useCase = new ForwardGatewaySubscriptionUseCase({ subscribe });
    const context = new GatewayContext(
      'Bearer access-token',
      { audience: ['gateway'], scopes: [], subject: 'buyer-1' },
      'request-1',
      {},
    );
    const request = { query: 'subscription { orderStatusChanged }' };

    const stream = useCase.execute(request, context);

    await expect(stream.next()).resolves.toEqual({
      done: false,
      value: { data: { orderStatusChanged: { status: 'PAID' } } },
    });
    expect(subscribe).toHaveBeenCalledWith(request, context);
  });
});
