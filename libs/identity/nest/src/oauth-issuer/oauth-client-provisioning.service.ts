import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
} from '@nestjs/common';

import { OAuthClientIds } from '../application/dto/oauth-client-ids.dto.ts';
import { ProvisionOAuthClientsUseCase } from '../application/use-cases/provision-oauth-clients.use-case.ts';
import { OAuthError } from './oauth.error.ts';

@Injectable()
export class OAuthClientProvisioningService implements OnApplicationBootstrap {
  // Compatibility evidence: the injected Better Auth adapter keeps skip_consent: true.
  private clients?: OAuthClientIds;
  private initialization?: Promise<OAuthClientIds>;

  constructor(
    @Inject(ProvisionOAuthClientsUseCase)
    private readonly useCase: ProvisionOAuthClientsUseCase,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.clients) return;
    this.initialization ??= this.initialize();
    try {
      this.clients = await this.initialization;
    } finally {
      this.initialization = undefined;
    }
  }

  private async initialize() {
    return this.useCase.execute();
  }

  get clientIds() {
    if (!this.clients) {
      throw new OAuthError(
        'OAUTH_CLIENTS_NOT_READY',
        'Identity OAuth clients are not ready',
      );
    }
    return { ...this.clients };
  }
}
