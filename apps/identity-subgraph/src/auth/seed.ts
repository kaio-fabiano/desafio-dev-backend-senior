import { pathToFileURL } from 'node:url';

import { MCP_TOOL_SCOPES } from './config.ts';

const GATEWAY_SOFTWARE_ID = 'identity-gateway';
const MCP_SOFTWARE_ID = 'apollo-mcp';
const DELEGATED_SCOPES = ['openid', 'profile', ...MCP_TOOL_SCOPES].join(' ');

type SeedCredentials = { email: string; password: string };
type ClientSeed = {
  name: string;
  redirectUri: string;
  softwareId: string;
};

async function seedClient(
  auth: ReturnType<typeof import('./config.ts').createIdentityAuth>,
  credentials: SeedCredentials,
  seed: ClientSeed,
) {
  const context = await auth.$context;
  const existing = await context.adapter.findOne<{ clientId: string }>({
    model: 'oauthClient',
    where: [{ field: 'softwareId', value: seed.softwareId }],
  });
  if (existing) return { clientId: existing.clientId, created: false };

  const administrator = await context.adapter.findOne({
    model: 'user',
    where: [{ field: 'email', value: credentials.email }],
  });
  let sessionCookie: string;
  if (!administrator) {
    const response = await auth.api.signUpEmail({
      body: {
        email: credentials.email,
        password: credentials.password,
        name: 'Identity client seed',
      },
      asResponse: true,
    });
    if (!response.ok) {
      throw new Error(
        `Identity client seed sign-up failed: ${response.status}`,
      );
    }
    sessionCookie = response.headers.get('set-cookie') ?? '';
  } else {
    const response = await auth.api.signInEmail({
      body: { email: credentials.email, password: credentials.password },
      asResponse: true,
    });
    if (!response.ok) {
      throw new Error(
        `Identity client seed sign-in failed: ${response.status}`,
      );
    }
    sessionCookie = response.headers.get('set-cookie') ?? '';
  }
  const client = await auth.api.adminCreateOAuthClient({
    headers: new Headers({ cookie: sessionCookie }),
    body: {
      client_name: seed.name,
      software_id: seed.softwareId,
      redirect_uris: [seed.redirectUri],
      scope: DELEGATED_SCOPES,
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      application_type: 'native',
      require_pkce: true,
    },
  });
  return { clientId: client.client_id, created: true };
}

export async function bootstrapIdentityAuth(
  auth: ReturnType<typeof import('./config.ts').createIdentityAuth>,
  credentials: SeedCredentials,
) {
  await (await auth.$context).runMigrations();
  const gateway = await seedGatewayClient(auth, credentials);
  const mcp = await seedMcpClient(auth, credentials);
  return { gateway, mcp };
}

export function seedGatewayClient(
  auth: ReturnType<typeof import('./config.ts').createIdentityAuth>,
  credentials: SeedCredentials,
) {
  return seedClient(auth, credentials, {
    name: 'Marketplace gateway',
    redirectUri: 'http://127.0.0.1:4000/oauth/callback',
    softwareId: GATEWAY_SOFTWARE_ID,
  });
}

export function seedMcpClient(
  auth: ReturnType<typeof import('./config.ts').createIdentityAuth>,
  credentials: SeedCredentials,
) {
  return seedClient(auth, credentials, {
    name: 'Apollo MCP',
    redirectUri: 'http://127.0.0.1:6274/oauth/callback',
    softwareId: MCP_SOFTWARE_ID,
  });
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  throw new Error(
    'Run this seed from the identity bootstrap with a configured database',
  );
}
