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
  const existing = await context.adapter.findOne({
    model: 'oauthClient',
    where: [{ field: 'softwareId', value: seed.softwareId }],
  });
  if (existing) return { clientId: existing.clientId, created: false };

  let administrator = await context.adapter.findOne({
    model: 'user',
    where: [{ field: 'email', value: credentials.email }],
  });
  if (!administrator) {
    administrator = context.test.createUser({
      id: 'identity-client-seed',
      email: credentials.email,
      name: 'Identity client seed',
    });
    await context.test.saveUser(administrator);
  }

  const login = await context.test.login({ userId: administrator.id });
  const client = await auth.api.adminCreateOAuthClient({
    headers: login.headers,
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
