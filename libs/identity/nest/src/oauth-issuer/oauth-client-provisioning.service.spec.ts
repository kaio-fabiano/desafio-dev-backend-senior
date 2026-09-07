import { describe, expect, it } from 'vitest';

import { OAuthClientProvisioningService } from './oauth-client-provisioning.service.ts';

describe('OAuthClientProvisioningService ownership', () => {
  it('reports that clients are unavailable before bootstrap @spec:AC-240', () => {
    const service = new OAuthClientProvisioningService(
      {} as never,
      {} as never,
    );

    expect(() => service.clientIds).toThrow(
      expect.objectContaining({ code: 'OAUTH_CLIENTS_NOT_READY' }),
    );
  });
});
