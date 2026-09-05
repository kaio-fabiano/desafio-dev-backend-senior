import type { AuthService } from '@thallesp/nestjs-better-auth';
import { describe, expect, it } from 'vitest';

import type { IdentityAuth } from '../better-auth/better-auth.factory.ts';
import { OAuthClientProvisioningService } from './oauth-client-provisioning.service.ts';

describe('OAuthClientProvisioningService ownership', () => {
  it('reports that clients are unavailable before bootstrap @spec:AC-240', () => {
    const service = new OAuthClientProvisioningService(
      {} as AuthService<IdentityAuth>,
    );

    expect(() => service.clientIds).toThrow(
      expect.objectContaining({ code: 'OAUTH_CLIENTS_NOT_READY' }),
    );
  });
});
