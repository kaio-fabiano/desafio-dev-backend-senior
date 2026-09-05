import { Controller, Get, Inject } from '@nestjs/common';

import { OAuthClientProvisioningService } from './oauth-client-provisioning.service.ts';

@Controller('oauth/clients')
export class OAuthClientsController {
  constructor(
    @Inject(OAuthClientProvisioningService)
    private readonly provisioning: OAuthClientProvisioningService,
  ) {}

  @Get()
  clients() {
    return this.provisioning.clientIds;
  }
}
