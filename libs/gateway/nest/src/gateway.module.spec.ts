import { describe, expect, it, vi } from 'vitest';

import { CaptureFederationResponseUseCase } from './application/use-cases/capture-federation-response.use-case.ts';
import { PrepareFederationRequestUseCase } from './application/use-cases/prepare-federation-request.use-case.ts';
import { AuthenticatedDataSource } from './federation/authenticated-data-source.ts';
import { GatewayFederationConfiguration } from './federation/gateway-federation.configuration.ts';
import { CommerceCookieAdapter } from './infrastructure/http/commerce-cookie.adapter.ts';
import { GatewayModule } from './gateway.module.ts';

describe('gateway federation policies', () => {
  it('loads the provider-managed Gateway module', () => {
    expect(GatewayModule).toBeDefined();
  });

  it('assigns least-privilege capabilities at composition', () => {
    expect(
      GatewayFederationConfiguration.capabilities(
        'identity',
        'http://identity/graphql',
      ),
    ).toEqual({ bearer: true });
    expect(
      GatewayFederationConfiguration.capabilities(
        'payment',
        'http://payment/graphql',
      ),
    ).toEqual({ bearer: true });
    expect(
      GatewayFederationConfiguration.capabilities(
        'order-workflow',
        'http://workflow/graphql',
      ),
    ).toEqual({ bearer: true, requestSession: true });
    expect(
      GatewayFederationConfiguration.capabilities(
        'wordpress',
        'http://wordpress/graphql',
      ),
    ).toEqual({
      origin: 'http://wordpress',
      requestSession: true,
      responseSession: true,
      wordpressCredential: true,
    });
    expect(
      GatewayFederationConfiguration.capabilities(
        'unknown',
        'http://unknown/graphql',
      ),
    ).toEqual({});
  });

  it('builds the private GraphQL context and policy-bound data sources', async () => {
    const auth = {
      create: vi.fn().mockResolvedValue({ requestId: 'request-1' }),
    };
    const config = {
      get: vi.fn((_name: string, fallback: string) => fallback),
    };
    const driver = new GatewayFederationConfiguration(
      auth as never,
      config as never,
      new PrepareFederationRequestUseCase(new CommerceCookieAdapter(), {
        exchange: async (subject) => `wordpress-${subject}`,
      }),
      new CaptureFederationResponseUseCase(),
    ).createGqlOptions();

    await expect(
      driver.server?.context?.({ req: 'request', res: 'response' } as never),
    ).resolves.toEqual({ requestId: 'request-1' });
    expect(auth.create).toHaveBeenCalledWith('request', 'response');

    const buildService = driver.gateway?.buildService;
    expect(
      buildService?.({ name: 'identity', url: 'http://identity/graphql' }),
    ).toBeInstanceOf(AuthenticatedDataSource);
    expect(() => buildService?.({ name: 'missing', url: undefined })).toThrow(
      'Subgraph missing URL is required',
    );
    expect(config.get).toHaveBeenCalledTimes(4);
  });
});
