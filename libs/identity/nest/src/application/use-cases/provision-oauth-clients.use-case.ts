import { OAuthClientIds } from '../dto/oauth-client-ids.dto.ts';
import { OAuthClientDefinition } from '../dto/oauth-client-definition.dto.ts';
import { OAuthClientProvisioningPolicy } from '../policies/oauth-client-provisioning.policy.ts';
import { OAuthClientProvisioningPort } from '../ports/oauth-client-provisioning.port.ts';
import { OAuthSeedCredentialsPort } from '../ports/oauth-seed-credentials.port.ts';

export class ProvisionOAuthClientsUseCase {
  constructor(
    private readonly clients: OAuthClientProvisioningPort,
    private readonly credentials: OAuthSeedCredentialsPort,
  ) {}

  async execute(): Promise<OAuthClientIds> {
    const resources = Object.values(OAuthClientProvisioningPolicy.resources);
    await this.clients.prepareResources(resources);
    return new OAuthClientIds(
      await this.provision(OAuthClientProvisioningPolicy.gateway, resources),
      await this.provision(OAuthClientProvisioningPolicy.mcp, resources),
    );
  }

  private async provision(
    definition: OAuthClientDefinition,
    resources: readonly string[],
  ): Promise<string> {
    const existing = await this.clients.findClient(definition.softwareId);
    if (existing) {
      await this.clients.ensureResourceLinks(existing, resources);
      return existing;
    }
    const session = await this.clients.openAdministratorSession(
      this.credentials.get(),
      'Identity client seed',
    );
    return this.clients.createClient(definition, session);
  }
}
