import { OAuthClientDefinition } from '../dto/oauth-client-definition.dto.ts';
import { OAuthSeedCredentials } from '../dto/oauth-seed-credentials.dto.ts';

export abstract class OAuthClientProvisioningPort {
  abstract createClient(
    definition: OAuthClientDefinition,
    sessionCookie: string,
  ): Promise<string>;
  abstract ensureResourceLinks(
    clientId: string,
    resourceIds: readonly string[],
  ): Promise<void>;
  abstract findClient(softwareId: string): Promise<string | undefined>;
  abstract openAdministratorSession(
    credentials: OAuthSeedCredentials,
    name: string,
  ): Promise<string>;
  abstract prepareResources(resourceIds: readonly string[]): Promise<void>;
}
