import { Module } from '@nestjs/common';

import { BetterAuthModule } from '../better-auth/better-auth.module.ts';
import { OAuthClientProvisioningPort } from '../application/ports/oauth-client-provisioning.port.ts';
import { OAuthSeedCredentialsPort } from '../application/ports/oauth-seed-credentials.port.ts';
import { BetterAuthOAuthClientProvisioningAdapter } from '../infrastructure/oauth/better-auth-oauth-client-provisioning.adapter.ts';
import { EnvironmentOAuthSeedCredentialsAdapter } from '../infrastructure/oauth/environment-oauth-seed-credentials.adapter.ts';
import { OAuthClientProvisioningService } from './oauth-client-provisioning.service.ts';
import { OAuthClientsController } from './oauth-clients.controller.ts';

@Module({
  imports: [BetterAuthModule],
  controllers: [OAuthClientsController],
  providers: [
    BetterAuthOAuthClientProvisioningAdapter,
    EnvironmentOAuthSeedCredentialsAdapter,
    {
      provide: OAuthClientProvisioningPort,
      useExisting: BetterAuthOAuthClientProvisioningAdapter,
    },
    {
      provide: OAuthSeedCredentialsPort,
      useExisting: EnvironmentOAuthSeedCredentialsAdapter,
    },
    OAuthClientProvisioningService,
  ],
})
export class OAuthIssuerModule {}
