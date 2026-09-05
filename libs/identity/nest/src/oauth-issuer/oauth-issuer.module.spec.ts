import { PATH_METADATA } from '@nestjs/common/constants.js';
import { Test } from '@nestjs/testing';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { describe, expect, it } from 'vitest';

import { BetterAuthFactory } from '../better-auth/better-auth.factory.ts';
import { WORDPRESS_CONFIGURATION } from '../wordpress/wordpress.config.ts';
import { OAuthClientProvisioningService } from './oauth-client-provisioning.service.ts';
import { OAuthClientsController } from './oauth-clients.controller.ts';
import { OAuthIssuerModule } from './oauth-issuer.module.ts';

describe('OAuthIssuerModule', () => {
  it('owns OAuth client provisioning and inspection @spec:AC-239 @spec:AC-240 @spec:AC-244', async () => {
    const clients = { gateway: 'gateway-client', mcp: 'mcp-client' };
    const auth = { api: {}, options: { basePath: '/api/auth', hooks: {} } };
    const module = await Test.createTestingModule({
      imports: [OAuthIssuerModule],
    })
      .overrideProvider(BetterAuthFactory)
      .useValue({ create: () => auth })
      .overrideProvider(OAuthClientProvisioningService)
      .useValue({ clientIds: clients })
      .overrideProvider(WORDPRESS_CONFIGURATION)
      .useValue({
        endpoint: 'https://wordpress.test',
        registrarIdentity: 'identity-registrar',
        siteToken: 'site-token',
      })
      .compile();

    expect(module.get(AuthService).instance).toBe(auth);
    expect(module.get(OAuthClientsController).clients()).toEqual(clients);
    expect(Reflect.getMetadata(PATH_METADATA, OAuthClientsController)).toBe(
      'oauth/clients',
    );

    await module.close();
  });
});
