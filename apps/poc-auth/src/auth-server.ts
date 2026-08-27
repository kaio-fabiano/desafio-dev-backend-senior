import { createServer, type IncomingHttpHeaders, type Server } from 'node:http';

import { oauthProvider } from '@better-auth/oauth-provider';
import { betterAuth } from 'better-auth';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { jwt, testUtils } from 'better-auth/plugins';

export const GATEWAY_AUDIENCE = 'https://gateway.poc.local';
export const MCP_AUDIENCE = 'https://mcp.poc.local';
export const REQUIRED_SCOPE = 'marketplace:read';

const AUTH_PATH = '/api/auth';
const AUTH_SECRET = 'milestone-zero-auth-proof-secret-at-least-32-characters';
const ADMINISTRATOR_ID = 'poc-auth-administrator';

type OAuthClient = {
  client_id: string;
  client_secret: string;
};

export type StartedAuthServer = {
  close(): Promise<void>;
  issueToken(resources: readonly string[]): Promise<string>;
  issuer: string;
  jwksUrl: string;
};

function requestHeaders(source: IncomingHttpHeaders): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(source)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }
  return headers;
}

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Better Auth proof server did not bind to a TCP port');
  }
  return address.port;
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

export async function startAuthServer(): Promise<StartedAuthServer> {
  let handler: ((request: Request) => Promise<Response>) | undefined;
  const server = createServer(async (incoming, outgoing) => {
    try {
      if (!handler) throw new Error('Better Auth handler is not initialized');
      const chunks: Buffer[] = [];
      for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
      const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
      const request = new Request(
        `http://${incoming.headers.host}${incoming.url ?? '/'}`,
        {
          method: incoming.method,
          headers: requestHeaders(incoming.headers),
          body,
        },
      );
      const response = await handler(request);
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      outgoing.writeHead(500, { 'content-type': 'text/plain' });
      outgoing.end(error instanceof Error ? error.message : String(error));
    }
  });

  const port = await listen(server);
  const origin = `http://127.0.0.1:${port}`;
  const issuer = `${origin}${AUTH_PATH}`;
  const database = {
    user: [],
    session: [],
    account: [],
    verification: [],
    jwks: [],
    oauthClient: [],
    oauthAccessToken: [],
    oauthRefreshToken: [],
    oauthAuthorizationCode: [],
    oauthConsent: [],
    oauthResource: [],
    oauthClientResource: [],
  };
  const auth = betterAuth({
    baseURL: origin,
    basePath: AUTH_PATH,
    database: memoryAdapter(database),
    secret: AUTH_SECRET,
    disabledPaths: ['/token'],
    plugins: [
      jwt({ disableSettingJwtHeader: true }),
      oauthProvider({
        loginPage: '/sign-in',
        consentPage: '/consent',
        scopes: [REQUIRED_SCOPE],
        resources: [
          { identifier: GATEWAY_AUDIENCE, allowedScopes: [REQUIRED_SCOPE] },
          { identifier: MCP_AUDIENCE, allowedScopes: [REQUIRED_SCOPE] },
        ],
        clientRegistrationDefaultResources: [GATEWAY_AUDIENCE, MCP_AUDIENCE],
        clientPrivileges: async ({ user }) => user?.id === ADMINISTRATOR_ID,
      }),
      testUtils(),
    ],
  });
  handler = auth.handler;

  try {
    const context = await auth.$context;
    const administrator = context.test.createUser({
      id: ADMINISTRATOR_ID,
      email: 'auth-proof@example.test',
      name: 'Auth proof administrator',
    });
    await context.test.saveUser(administrator);
    const login = await context.test.login({ userId: administrator.id });
    const client = (await auth.api.adminCreateOAuthClient({
      headers: login.headers,
      body: {
        client_name: 'Milestone 0 multi-resource proof',
        grant_types: ['client_credentials'],
        token_endpoint_auth_method: 'client_secret_basic',
        client_credentials_scopes: [REQUIRED_SCOPE],
      },
    })) as OAuthClient;

    return {
      issuer,
      jwksUrl: `${issuer}/jwks`,
      async issueToken(resources) {
        const body = new URLSearchParams({
          grant_type: 'client_credentials',
          scope: REQUIRED_SCOPE,
        });
        for (const resource of resources) body.append('resource', resource);

        const response = await fetch(`${issuer}/oauth2/token`, {
          method: 'POST',
          headers: {
            authorization: `Basic ${Buffer.from(`${client.client_id}:${client.client_secret}`).toString('base64')}`,
            'content-type': 'application/x-www-form-urlencoded',
          },
          body,
        });
        const result = (await response.json()) as {
          access_token?: string;
          error?: string;
          error_description?: string;
        };
        if (!response.ok || !result.access_token) {
          throw new Error(
            `Better Auth token request failed: ${result.error ?? response.status} ${result.error_description ?? ''}`.trim(),
          );
        }
        return result.access_token;
      },
      close: () => close(server),
    };
  } catch (error) {
    await close(server);
    throw error;
  }
}
