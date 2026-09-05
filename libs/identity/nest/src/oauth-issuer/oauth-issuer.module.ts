import { Module } from '@nestjs/common';

import { BetterAuthModule } from '../better-auth/better-auth.module.ts';
import { OAuthClientProvisioningService } from './oauth-client-provisioning.service.ts';
import { OAuthClientsController } from './oauth-clients.controller.ts';

@Module({
  imports: [BetterAuthModule],
  controllers: [OAuthClientsController],
  providers: [OAuthClientProvisioningService],
})
export class OAuthIssuerModule {}
