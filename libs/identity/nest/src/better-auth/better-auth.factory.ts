import { oauthProvider } from '@better-auth/oauth-provider';
import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { betterAuth } from 'better-auth';
import { jwt } from 'better-auth/plugins';
import { Pool } from 'pg';

import { BetterAuthError } from './better-auth.error.ts';
import {
  DELEGATED_OAUTH_SCOPES,
  OAUTH_RESOURCES,
  OAUTH_RESOURCE_SCOPES,
} from '../oauth-issuer/oauth-resources.ts';
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
    skip_consent: true;
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

@Injectable()
export class IdentityDatabasePool implements OnModuleDestroy {
  private database?: Pool;

  get connection(): Pool {
    this.database ??= new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.NODE_ENV === 'production' &&
        process.env.DATABASE_SSL !== 'false'
          ? { rejectUnauthorized: true }
          : undefined,
    });
    return this.database;
  }

  async onModuleDestroy() {
    const database = this.database;
    this.database = undefined;
    await database?.end();
  }
}

@Injectable()
export class BetterAuthFactory {
  constructor(
    @Inject(IdentityDatabasePool)
    private readonly pool: IdentityDatabasePool = new IdentityDatabasePool(),
  ) {}

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
    const trustedOrigins = process.env.IDENTITY_TRUSTED_ORIGINS?.split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
    if (process.env.NODE_ENV === 'production' && !secret) {
      throw new BetterAuthError(
        'BETTER_AUTH_SECRET_REQUIRED',
        'BETTER_AUTH_SECRET is required in production',
      );
    }
    return betterAuth({
      baseURL:
        options.baseURL ??
        process.env.IDENTITY_BASE_URL ??
        'http://localhost:3001',
      basePath: '/api/auth',
      database: options.database ?? this.pool.connection,
      secret,
      trustedOrigins,
      emailAndPassword: { enabled: true },
      disabledPaths: ['/token'],
      hooks: {},
      plugins: [
        jwt({
          disableSettingJwtHeader: true,
          jwt: { issuer },
          jwks: { keyPairConfig: { alg: 'ES256' } },
        }),
        oauthProvider({
          loginPage: '/sign-in',
          consentPage: '/consent',
          scopes: ['openid', 'profile', ...DELEGATED_OAUTH_SCOPES],
          resources: Object.values(OAUTH_RESOURCES).map((identifier) => ({
            identifier,
            allowedScopes: [...OAUTH_RESOURCE_SCOPES[identifier]],
            signingAlgorithm: 'ES256' as const,
          })),
          clientRegistrationDefaultResources: Object.values(OAUTH_RESOURCES),
          clientPrivileges: async ({ user }) => user?.email === seedAdminEmail,
        }) as never,
      ],
    }) as unknown as IdentityAuth;
  }
}
