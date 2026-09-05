import { describe, expect, it, vi } from 'vitest';

import { AuthenticatedDataSource } from './federation/authenticated-data-source.ts';
import {
  federationCapabilities,
  gatewayDriverConfig,
} from './gateway.module.ts';

describe('gateway federation policies', () => {
  it('assigns least-privilege capabilities at composition', () => {
    expect(
      federationCapabilities('identity', 'http://identity/graphql'),
    ).toEqual({ bearer: true });
    expect(federationCapabilities('payment', 'http://payment/graphql')).toEqual(
      { bearer: true },
    );
    expect(
      federationCapabilities('order-workflow', 'http://workflow/graphql'),
    ).toEqual({ bearer: true, requestSession: true });
    expect(
      federationCapabilities('wordpress', 'http://wordpress/graphql'),
    ).toEqual({
      origin: 'http://wordpress',
      requestSession: true,
      responseSession: true,
    });
    expect(federationCapabilities('unknown', 'http://unknown/graphql')).toEqual(
      {},
    );
  });

  it('builds the private GraphQL context and policy-bound data sources', async () => {
    const auth = {
      create: vi.fn().mockResolvedValue({ requestId: 'request-1' }),
    };
    const config = {
      get: vi.fn((_name: string, fallback: string) => fallback),
    };
    const driver = gatewayDriverConfig(auth as never, config as never);

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
