import { oauthProvider } from '@better-auth/oauth-provider';
import { betterAuth } from 'better-auth';
import { jwt, testUtils } from 'better-auth/plugins';

export const GATEWAY_AUDIENCE = 'https://gateway.marketplace.local';
export const MCP_AUDIENCE = 'https://mcp.marketplace.local';
export const MARKETPLACE_READ_SCOPE = 'marketplace:read';
export const CART_READ_SCOPE = 'cart:read';
export const ORDERS_READ_SCOPE = 'orders:read';
export const CART_WRITE_SCOPE = 'cart:write';
export const MCP_TOOL_SCOPES = [
  MARKETPLACE_READ_SCOPE,
  CART_READ_SCOPE,
  ORDERS_READ_SCOPE,
  CART_WRITE_SCOPE,
];

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
        scopes: ['openid', 'profile', ...MCP_TOOL_SCOPES],
        resources: [
          {
            identifier: GATEWAY_AUDIENCE,
            allowedScopes: MCP_TOOL_SCOPES,
          },
          {
            identifier: MCP_AUDIENCE,
            allowedScopes: MCP_TOOL_SCOPES,
          },
        ],
        clientRegistrationDefaultResources: [GATEWAY_AUDIENCE, MCP_AUDIENCE],
        clientPrivileges: async ({ user }) =>
          user?.email === options.seedAdminEmail,
      }),
      testUtils(),
    ],
  });
}
