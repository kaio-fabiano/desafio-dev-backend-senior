import { pathToFileURL } from 'node:url';

const SOFTWARE_ID = 'identity-gateway';

type SeedCredentials = { email: string; password: string };

export async function seedGatewayClient(
  auth: ReturnType<typeof import('./config.ts').createIdentityAuth>,
  credentials: SeedCredentials,
) {
  const context = await auth.$context;
  const existing = await context.adapter.findOne({
    model: 'oauthClient',
    where: [{ field: 'softwareId', value: SOFTWARE_ID }],
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
      client_name: 'Marketplace gateway',
      software_id: SOFTWARE_ID,
      redirect_uris: ['http://127.0.0.1:4000/oauth/callback'],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      application_type: 'native',
      require_pkce: true,
    },
  });
  return { clientId: client.client_id, created: true };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  throw new Error('Run this seed from the identity bootstrap with a configured database');
}
