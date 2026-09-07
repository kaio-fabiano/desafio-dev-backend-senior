import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';

import type { IdentityAuth } from '../better-auth/identity-auth.types.d.ts';
import { OAuthClientDefinition } from '../application/dto/oauth-client-definition.dto.ts';
import { OAuthClientIds } from '../application/dto/oauth-client-ids.dto.ts';
import { OAuthSeedCredentials } from '../application/dto/oauth-seed-credentials.dto.ts';
import { OAuthClientProvisioningPort } from '../application/ports/oauth-client-provisioning.port.ts';
import { OAuthSeedCredentialsPort } from '../application/ports/oauth-seed-credentials.port.ts';
import { ProvisionOAuthClientsUseCase } from '../application/use-cases/provision-oauth-clients.use-case.ts';
import { IdentityBootstrap } from '../registration/identity-bootstrap.ts';
import { OAuthError } from './oauth.error.ts';

@Injectable()
export class OAuthClientProvisioningService implements OnApplicationBootstrap {
  private clients?: OAuthClientIds;
  private initialization?: Promise<OAuthClientIds>;

  constructor(
    @Inject(AuthService)
    private readonly auth: AuthService<IdentityAuth>,
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
    const context = await this.auth.instance.$context;
    const adapter = context.adapter;
    const clients = {
      createClient: async (
        definition: OAuthClientDefinition,
        sessionCookie: string,
      ) => {
        const client = await this.auth.api.adminCreateOAuthClient({
          headers: new Headers({ cookie: sessionCookie }),
          body: {
            client_name: definition.name,
            software_id: definition.softwareId,
            redirect_uris: [definition.redirectUri],
            scope: definition.scopes.join(' '),
            grant_types: ['authorization_code'],
            response_types: ['code'],
            token_endpoint_auth_method: 'none',
            application_type: 'native',
            require_pkce: true,
            skip_consent: true,
          },
        });
        return client.client_id;
      },
      ensureResourceLinks: async (
        clientId: string,
        resourceIds: readonly string[],
      ) => {
        const links = await adapter.findMany<{ resourceId: string }>({
          model: 'oauthClientResource',
          where: [{ field: 'clientId', value: clientId }],
        });
        const linkedResources = new Set(
          links.map(({ resourceId }) => resourceId),
        );
        for (const resourceId of resourceIds) {
          if (linkedResources.has(resourceId)) continue;
          await adapter.create({
            model: 'oauthClientResource',
            data: { clientId, resourceId, createdAt: new Date() },
          });
        }
      },
      findClient: async (softwareId: string) =>
        (
          await adapter.findOne<{ clientId: string }>({
            model: 'oauthClient',
            where: [{ field: 'softwareId', value: softwareId }],
          })
        )?.clientId,
      openAdministratorSession: async (
        credentials: OAuthSeedCredentials,
        name: string,
      ) => {
        const administrator = await adapter.findOne<{ id: string }>({
          model: 'user',
          where: [{ field: 'email', value: credentials.email }],
        });
        const response = administrator
          ? await this.auth.api.signInEmail({
              body: credentials,
              asResponse: true,
            })
          : await this.auth.api.signUpEmail({
              body: { ...credentials, name },
              headers: IdentityBootstrap.headers(),
              asResponse: true,
            });
        if (!response.ok) {
          throw new OAuthError(
            'OAUTH_CLIENT_SEED_FAILED',
            `Identity client seed failed: ${response.status}`,
          );
        }
        return response.headers
          .getSetCookie()
          .map((value) => value.split(';', 1)[0])
          .filter(Boolean)
          .join('; ');
      },
      prepareResources: async (resourceIds: readonly string[]) => {
        await context.runMigrations();
        for (const identifier of resourceIds) {
          await adapter.update({
            model: 'oauthResource',
            where: [{ field: 'identifier', value: identifier }],
            update: { signingAlgorithm: 'ES256', updatedAt: new Date() },
          });
        }
      },
    } satisfies OAuthClientProvisioningPort;
    const credentials = {
      get: () => this.seedCredentials(),
    } satisfies OAuthSeedCredentialsPort;
    return new ProvisionOAuthClientsUseCase(clients, credentials).execute();
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

  private seedCredentials(): OAuthSeedCredentials {
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!password) {
      throw new OAuthError(
        'SEED_ADMIN_PASSWORD_REQUIRED',
        'SEED_ADMIN_PASSWORD is required to create OAuth clients',
      );
    }
    return new OAuthSeedCredentials(
      process.env.SEED_ADMIN_EMAIL ?? 'admin@marketplace.local',
      password,
    );
  }
}
