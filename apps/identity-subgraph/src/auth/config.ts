import { oauthProvider } from '@better-auth/oauth-provider';
import { betterAuth } from 'better-auth';
import { jwt, testUtils } from 'better-auth/plugins';

export const GATEWAY_AUDIENCE = 'https://gateway.marketplace.local';
export const MARKETPLACE_READ_SCOPE = 'marketplace:read';

type IdentityAuthOptions = {
  baseURL: string;
  secret: string;
  seedAdminEmail: string;
};

export function createIdentityAuth(
  database: Parameters<typeof betterAuth>[0]['database'],
  options: IdentityAuthOptions,
) {
  return betterAuth({
    baseURL: options.baseURL,
    basePath: '/api/auth',
    database,
    secret: options.secret,
    disabledPaths: ['/token'],
    plugins: [
      jwt({ disableSettingJwtHeader: true }),
      oauthProvider({
        loginPage: '/sign-in',
        consentPage: '/consent',
        scopes: ['openid', 'profile', MARKETPLACE_READ_SCOPE],
        resources: [
          {
            identifier: GATEWAY_AUDIENCE,
            allowedScopes: [MARKETPLACE_READ_SCOPE],
          },
        ],
        clientRegistrationDefaultResources: [GATEWAY_AUDIENCE],
        clientPrivileges: async ({ user }) =>
          user?.email === options.seedAdminEmail,
      }),
      testUtils(),
    ],
  });
}
