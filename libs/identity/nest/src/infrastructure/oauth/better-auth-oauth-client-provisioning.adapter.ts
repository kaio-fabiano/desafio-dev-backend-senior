import { Inject, Injectable } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';

import { OAuthClientDefinition } from '../../application/dto/oauth-client-definition.dto.ts';
import { OAuthSeedCredentials } from '../../application/dto/oauth-seed-credentials.dto.ts';
import { OAuthError } from '../../application/errors/oauth.error.ts';
import { OAuthClientProvisioningPort } from '../../application/ports/oauth-client-provisioning.port.ts';
import type { IdentityAuth } from '../../better-auth/identity-auth.types.d.ts';
import { IdentityBootstrap } from '../../registration/identity-bootstrap.ts';

@Injectable()
export class BetterAuthOAuthClientProvisioningAdapter
  implements OAuthClientProvisioningPort
{
  constructor(
    @Inject(AuthService)
    private readonly auth: AuthService<IdentityAuth>,
  ) {}

  async createClient(
    definition: OAuthClientDefinition,
    sessionCookie: string,
  ): Promise<string> {
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
  }

  async ensureResourceLinks(
    clientId: string,
    resourceIds: readonly string[],
  ): Promise<void> {
    const adapter = (await this.auth.instance.$context).adapter;
    const links = await adapter.findMany<{ resourceId: string }>({
      model: 'oauthClientResource',
      where: [{ field: 'clientId', value: clientId }],
    });
    const linkedResources = new Set(links.map(({ resourceId }) => resourceId));
    for (const resourceId of resourceIds) {
      if (linkedResources.has(resourceId)) continue;
      await adapter.create({
        model: 'oauthClientResource',
        data: { clientId, resourceId, createdAt: new Date() },
      });
    }
  }

  async findClient(softwareId: string): Promise<string | undefined> {
    return (
      await (
        await this.auth.instance.$context
      ).adapter.findOne<{ clientId: string }>({
        model: 'oauthClient',
        where: [{ field: 'softwareId', value: softwareId }],
      })
    )?.clientId;
  }

  async openAdministratorSession(
    credentials: OAuthSeedCredentials,
    name: string,
  ): Promise<string> {
    const adapter = (await this.auth.instance.$context).adapter;
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
  }

  async prepareResources(resourceIds: readonly string[]): Promise<void> {
    const context = await this.auth.instance.$context;
    await context.runMigrations();
    for (const identifier of resourceIds) {
      await context.adapter.update({
        model: 'oauthResource',
        where: [{ field: 'identifier', value: identifier }],
        update: { signingAlgorithm: 'ES256', updatedAt: new Date() },
      });
    }
  }
}
