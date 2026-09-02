import { oauthProvider } from '@better-auth/oauth-provider';
import {
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { betterAuth } from 'better-auth';
import { jwt } from 'better-auth/plugins';
import { Pool } from 'pg';

import { identityBootstrapHeaders } from './registration.service.ts';
import {
  MCP_TOOL_SCOPES,
  OAUTH_RESOURCES,
  OAUTH_RESOURCE_SCOPES,
} from './resource-audiences.ts';

type IdentityDatabase = NonNullable<
  Parameters<typeof betterAuth>[0]['database']
>;

export type IdentityAuthOptions = {
  baseURL?: string;
  database?: IdentityDatabase;
  issuer?: string;
  secret?: string;
  seedAdminEmail?: string;
};

type BaseIdentityAuth = ReturnType<typeof betterAuth>;
type OAuthClientInput = {
  headers: Headers;
  body: {
    application_type: 'native';
    client_name: string;
    grant_types: ['authorization_code'];
    redirect_uris: [string];
    require_pkce: true;
    response_types: ['code'];
    scope: string;
    software_id: string;
    token_endpoint_auth_method: 'none';
  };
};

export type IdentityAuth = BaseIdentityAuth & {
  api: BaseIdentityAuth['api'] & {
    adminCreateOAuthClient(
      input: OAuthClientInput,
    ): Promise<{ client_id: string }>;
  };
};

export class BetterAuthFactory implements OnModuleDestroy {
  private database?: Pool;

  create(options: IdentityAuthOptions = {}): IdentityAuth {
    const seedAdminEmail =
      options.seedAdminEmail ??
      process.env.SEED_ADMIN_EMAIL ??
      'admin@marketplace.local';
    const issuer =
      options.issuer ??
      process.env.OAUTH_ISSUER ??
      'https://identity-subgraph:3001/api/auth';
    const secret = options.secret ?? process.env.BETTER_AUTH_SECRET;
    if (process.env.NODE_ENV === 'production' && !secret) {
      throw new Error('BETTER_AUTH_SECRET is required in production');
    }

    return betterAuth({
      baseURL:
        options.baseURL ??
        process.env.IDENTITY_BASE_URL ??
        'http://localhost:3001',
      basePath: '/api/auth',
      database: options.database ?? this.getDatabase(),
      secret,
      emailAndPassword: { enabled: true },
      disabledPaths: ['/token'],
      hooks: {},
      plugins: [
        jwt({
          disableSettingJwtHeader: true,
          jwt: { issuer },
        }),
        oauthProvider({
          loginPage: '/sign-in',
          consentPage: '/consent',
          scopes: ['openid', 'profile', ...MCP_TOOL_SCOPES],
          resources: Object.values(OAUTH_RESOURCES).map((identifier) => ({
            identifier,
            allowedScopes: [...OAUTH_RESOURCE_SCOPES[identifier]],
          })),
          clientRegistrationDefaultResources: Object.values(OAUTH_RESOURCES),
          clientPrivileges: async ({ user }) => user?.email === seedAdminEmail,
        }) as never,
      ],
    }) as unknown as IdentityAuth;
  }

  async onModuleDestroy() {
    await this.database?.end();
  }

  private getDatabase() {
    this.database ??= new Pool({ connectionString: process.env.DATABASE_URL });
    return this.database;
  }
}

Injectable()(BetterAuthFactory);

type OAuthClientSeed = {
  name: string;
  redirectUri: string;
  softwareId: string;
};

type SeededClient = { clientId: string; created: boolean };

export class IdentityAuthBootstrap implements OnApplicationBootstrap {
  private clients?: { gateway: SeededClient; mcp: SeededClient };

  constructor(private readonly auth: AuthService<IdentityAuth>) {}

  async onApplicationBootstrap() {
    const seedPassword = process.env.SEED_ADMIN_PASSWORD;
    if (!seedPassword) {
      throw new Error('SEED_ADMIN_PASSWORD is required');
    }
    const credentials = {
      email: process.env.SEED_ADMIN_EMAIL ?? 'admin@marketplace.local',
      password: seedPassword,
    };
    await (await this.auth.instance.$context).runMigrations();
    this.clients = {
      gateway: await this.seedClient(credentials, {
        name: 'Marketplace gateway',
        redirectUri: 'http://127.0.0.1:4000/oauth/callback',
        softwareId: 'identity-gateway',
      }),
      mcp: await this.seedClient(credentials, {
        name: 'Apollo MCP',
        redirectUri: 'http://127.0.0.1:6274/oauth/callback',
        softwareId: 'apollo-mcp',
      }),
    };
  }

  get clientIds() {
    if (!this.clients) throw new Error('Identity OAuth clients are not ready');
    return {
      gateway: this.clients.gateway.clientId,
      mcp: this.clients.mcp.clientId,
    };
  }

  private async seedClient(
    credentials: { email: string; password: string },
    seed: OAuthClientSeed,
  ): Promise<SeededClient> {
    const context = await this.auth.instance.$context;
    const existing = await context.adapter.findOne<{ clientId: string }>({
      model: 'oauthClient',
      where: [{ field: 'softwareId', value: seed.softwareId }],
    });
    if (existing) return { clientId: existing.clientId, created: false };

    const administrator = await context.adapter.findOne<{ id: string }>({
      model: 'user',
      where: [{ field: 'email', value: credentials.email }],
    });
    const response = administrator
      ? await this.auth.api.signInEmail({
          body: credentials,
          asResponse: true,
        })
      : await this.auth.api.signUpEmail({
          body: { ...credentials, name: 'Identity client seed' },
          headers: identityBootstrapHeaders(),
          asResponse: true,
        });
    if (!response.ok) {
      throw new Error(`Identity client seed failed: ${response.status}`);
    }

    const client = await this.auth.api.adminCreateOAuthClient({
      headers: new Headers({
        cookie: response.headers.get('set-cookie') ?? '',
      }),
      body: {
        client_name: seed.name,
        software_id: seed.softwareId,
        redirect_uris: [seed.redirectUri],
        scope: ['openid', 'profile', ...MCP_TOOL_SCOPES].join(' '),
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        application_type: 'native',
        require_pkce: true,
      },
    });
    return { clientId: client.client_id, created: true };
  }
}

Injectable()(IdentityAuthBootstrap);
Inject(AuthService)(IdentityAuthBootstrap, undefined, 0);
