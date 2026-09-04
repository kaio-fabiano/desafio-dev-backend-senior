import { oauthProvider } from '@better-auth/oauth-provider';
import { betterAuth } from 'better-auth';
import { jwt } from 'better-auth/plugins';

export const GATEWAY_AUDIENCE = 'https://gateway.marketplace.local';
export const IDENTITY_AUDIENCE = 'https://identity.marketplace.local';
export const MCP_AUDIENCE = 'https://mcp.marketplace.local';
export const ORDER_WORKFLOW_AUDIENCE =
  'https://order-workflow.marketplace.local';
export const PAYMENT_AUDIENCE = 'https://payment.marketplace.local';
export const MARKETPLACE_READ_SCOPE = 'marketplace:read';
export const CART_READ_SCOPE = 'cart:read';
export const ORDERS_READ_SCOPE = 'orders:read';
export const CART_WRITE_SCOPE = 'cart:write';
export const MCP_SCOPE = 'mcp:tools';
export const MCP_TOOL_SCOPES = [
  MCP_SCOPE,
  MARKETPLACE_READ_SCOPE,
  CART_READ_SCOPE,
  ORDERS_READ_SCOPE,
  CART_WRITE_SCOPE,
];

type IdentityAuthOptions = {
  baseURL: string;
  issuer?: string;
  secret: string;
  seedAdminEmail: string;
};

type BaseIdentityAuth = ReturnType<typeof betterAuth>;
type IdentityAuth = BaseIdentityAuth & {
  api: BaseIdentityAuth['api'] & {
    adminCreateOAuthClient(input: unknown): Promise<{ client_id: string }>;
  };
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
    emailAndPassword: { enabled: true },
    disabledPaths: ['/token'],
    plugins: [
      jwt({
        disableSettingJwtHeader: true,
        jwt: options.issuer ? { issuer: options.issuer } : undefined,
        jwks: { keyPairConfig: { alg: 'ES256' } },
      }),
      oauthProvider({
        loginPage: '/sign-in',
        consentPage: '/consent',
        scopes: ['openid', 'profile', ...MCP_TOOL_SCOPES],
        resources: [
          {
            identifier: GATEWAY_AUDIENCE,
            allowedScopes: MCP_TOOL_SCOPES,
            signingAlgorithm: 'ES256',
          },
          {
            identifier: IDENTITY_AUDIENCE,
            allowedScopes: MCP_TOOL_SCOPES,
            signingAlgorithm: 'ES256',
          },
          {
            identifier: MCP_AUDIENCE,
            allowedScopes: MCP_TOOL_SCOPES,
            signingAlgorithm: 'ES256',
          },
          {
            identifier: ORDER_WORKFLOW_AUDIENCE,
            allowedScopes: MCP_TOOL_SCOPES,
            signingAlgorithm: 'ES256',
          },
          {
            identifier: PAYMENT_AUDIENCE,
            allowedScopes: MCP_TOOL_SCOPES,
            signingAlgorithm: 'ES256',
          },
        ],
        clientRegistrationDefaultResources: [
          GATEWAY_AUDIENCE,
          IDENTITY_AUDIENCE,
          MCP_AUDIENCE,
          ORDER_WORKFLOW_AUDIENCE,
          PAYMENT_AUDIENCE,
        ],
        clientPrivileges: async ({ user }) =>
          user?.email === options.seedAdminEmail,
      }) as never,
    ],
  }) as unknown as IdentityAuth;
}
