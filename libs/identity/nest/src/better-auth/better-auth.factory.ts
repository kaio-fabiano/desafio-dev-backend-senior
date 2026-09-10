import { oauthProvider } from '@better-auth/oauth-provider';
import { Inject, Injectable } from '@nestjs/common';
import { betterAuth } from 'better-auth';
import { jwt } from 'better-auth/plugins';

import { OAuthResources } from '../oauth-issuer/oauth-resources.ts';
import { IdentityErrorMessages } from '../application/errors/identity-error-messages.ts';
import { BetterAuthError } from './better-auth.error.ts';
import type {
  IdentityAuth,
  IdentityAuthOptions,
} from './identity-auth.types.d.ts';
import { IdentityDatabasePool } from './identity-database-pool.provider.ts';

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
        IdentityErrorMessages.betterAuth.BETTER_AUTH_SECRET_REQUIRED,
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
          scopes: ['openid', 'profile', ...OAuthResources.delegatedScopes],
          resources: Object.values(OAuthResources.resources).map(
            (identifier) => ({
              identifier,
              allowedScopes: [...OAuthResources.resourceScopes[identifier]],
              signingAlgorithm: 'ES256' as const,
            }),
          ),
          clientRegistrationDefaultResources: Object.values(
            OAuthResources.resources,
          ),
          clientPrivileges: async ({ user }) => user?.email === seedAdminEmail,
        }) as never,
      ],
    }) as unknown as IdentityAuth;
  }
}
