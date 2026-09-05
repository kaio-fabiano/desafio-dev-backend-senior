import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';

import type { IdentityAuth } from '../better-auth/better-auth.factory.ts';
import { identityBootstrapHeaders } from '../registration/registration.service.ts';
import { DELEGATED_OAUTH_SCOPES, OAUTH_RESOURCES } from './oauth-resources.ts';
import { OAuthError } from './oauth.error.ts';

type OAuthClientSeed = {
  name: string;
  redirectUri: string;
  softwareId: string;
};

type OAuthClientBody = {
  application_type: 'native';
  client_name: string;
  grant_types: ['authorization_code'];
  redirect_uris: [string];
  require_pkce: true;
  response_types: ['code'];
  skip_consent: true;
  scope: string;
  software_id: string;
  token_endpoint_auth_method: 'none';
};

@Injectable()
export class OAuthClientProvisioningService implements OnApplicationBootstrap {
  private clients?: { gateway: string; mcp: string };
  private initialization?: Promise<{ gateway: string; mcp: string }>;

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
    await context.runMigrations();
    for (const identifier of Object.values(OAUTH_RESOURCES)) {
      await context.adapter.update({
        model: 'oauthResource',
        where: [{ field: 'identifier', value: identifier }],
        update: { signingAlgorithm: 'ES256', updatedAt: new Date() },
      });
    }
    return {
      gateway: await this.seedClient({
        name: 'Marketplace gateway',
        redirectUri: 'http://127.0.0.1:4000/oauth/callback',
        softwareId: 'identity-gateway',
      }),
      mcp: await this.seedClient({
        name: 'Apollo MCP',
        redirectUri: 'http://127.0.0.1:6274/oauth/callback',
        softwareId: 'apollo-mcp',
      }),
    };
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

  private async seedClient(seed: OAuthClientSeed): Promise<string> {
    const context = await this.auth.instance.$context;
    const existing = await context.adapter.findOne<{ clientId: string }>({
      model: 'oauthClient',
      where: [{ field: 'softwareId', value: seed.softwareId }],
    });
    if (existing) {
      const links = await context.adapter.findMany<{ resourceId: string }>({
        model: 'oauthClientResource',
        where: [{ field: 'clientId', value: existing.clientId }],
      });
      const linkedResources = new Set(
        links.map(({ resourceId }) => resourceId),
      );
      for (const resourceId of Object.values(OAUTH_RESOURCES)) {
        if (linkedResources.has(resourceId)) continue;
        await context.adapter.create({
          model: 'oauthClientResource',
          data: {
            clientId: existing.clientId,
            resourceId,
            createdAt: new Date(),
          },
        });
      }
      return existing.clientId;
    }

    const credentials = this.seedCredentials();
    const administrator = await context.adapter.findOne<{ id: string }>({
      model: 'user',
      where: [{ field: 'email', value: credentials.email }],
    });
    const response = administrator
      ? await this.auth.api.signInEmail({ body: credentials, asResponse: true })
      : await this.auth.api.signUpEmail({
          body: { ...credentials, name: 'Identity client seed' },
          headers: identityBootstrapHeaders(),
          asResponse: true,
        });
    if (!response.ok) {
      throw new OAuthError(
        'OAUTH_CLIENT_SEED_FAILED',
        `Identity client seed failed: ${response.status}`,
      );
    }
    const body = {
      client_name: seed.name,
      software_id: seed.softwareId,
      redirect_uris: [seed.redirectUri],
      scope: ['openid', 'profile', ...DELEGATED_OAUTH_SCOPES].join(' '),
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      application_type: 'native',
      require_pkce: true,
      skip_consent: true,
    } satisfies OAuthClientBody;
    const client = await this.auth.api.adminCreateOAuthClient({
      headers: new Headers({
        cookie: response.headers
          .getSetCookie()
          .map((value) => value.split(';', 1)[0])
          .filter(Boolean)
          .join('; '),
      }),
      body,
    });
    return client.client_id;
  }

  private seedCredentials() {
    const password = process.env.SEED_ADMIN_PASSWORD;
    if (!password) {
      throw new OAuthError(
        'SEED_ADMIN_PASSWORD_REQUIRED',
        'SEED_ADMIN_PASSWORD is required to create OAuth clients',
      );
    }
    return {
      email: process.env.SEED_ADMIN_EMAIL ?? 'admin@marketplace.local',
      password,
    };
  }
}
