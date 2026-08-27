import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { test } from 'node:test';

import { oauthProviderResourceClient } from '@better-auth/oauth-provider/resource-client';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { createAuthClient } from 'better-auth/client';

import {
  CART_WRITE_SCOPE,
  GATEWAY_AUDIENCE,
  MCP_AUDIENCE,
  REQUIRED_SCOPE,
  startAuthServer,
} from './fixtures/auth-server.ts';
import {
  CART_READ_SCOPE,
  CART_WRITE_SCOPE as IDENTITY_CART_WRITE_SCOPE,
  GATEWAY_AUDIENCE as IDENTITY_GATEWAY_AUDIENCE,
  MARKETPLACE_READ_SCOPE,
  MCP_AUDIENCE as IDENTITY_MCP_AUDIENCE,
  MCP_SCOPE,
  MCP_TOOL_SCOPES,
  ORDERS_READ_SCOPE,
  createIdentityAuth,
} from '../apps/identity-subgraph/src/auth/config.ts';
import {
  seedGatewayClient,
  seedMcpClient,
} from '../apps/identity-subgraph/src/auth/seed.ts';

const resourceClient = createAuthClient({
  plugins: [oauthProviderResourceClient()],
});

function verify(token, auth, audience, requiredScopes, issuer = auth.issuer) {
  return resourceClient.verifyAccessTokenRequest(
    new Request(audience, {
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
    {
      jwksUrl: auth.jwksUrl,
      verifyOptions: { issuer, audience },
      requiredScopes,
    },
  );
}

async function rejects(action) {
  await assert.rejects(action);
}

test('AC-062: Invalid MCP authentication is rejected @spec:AC-062', async () => {
  const auth = await startAuthServer();
  try {
    const gatewayOnly = await auth.issueToken([GATEWAY_AUDIENCE]);
    const mcpOnly = await auth.issueToken([MCP_AUDIENCE]);

    await rejects(() => verify('', auth, MCP_AUDIENCE, [REQUIRED_SCOPE]));
    await rejects(() =>
      verify(gatewayOnly, auth, MCP_AUDIENCE, [REQUIRED_SCOPE]),
    );
    await rejects(() =>
      verify(
        mcpOnly,
        auth,
        MCP_AUDIENCE,
        [REQUIRED_SCOPE],
        'https://wrong-issuer.test',
      ),
    );
    await verify(mcpOnly, auth, MCP_AUDIENCE, [REQUIRED_SCOPE]);
    await rejects(() =>
      verify(mcpOnly, auth, GATEWAY_AUDIENCE, [REQUIRED_SCOPE]),
    );
  } finally {
    await auth.close();
  }

  const shortLived = await startAuthServer({ m2mAccessTokenExpiresIn: 1 });
  try {
    const expired = await shortLived.issueToken([MCP_AUDIENCE]);
    await delay(1_100);
    await rejects(() =>
      verify(expired, shortLived, MCP_AUDIENCE, [REQUIRED_SCOPE]),
    );
  } finally {
    await shortLived.close();
  }
});

test('AC-063: Tool scopes are enforced @spec:AC-063', async () => {
  assert.deepEqual(MCP_TOOL_SCOPES, [
    MCP_SCOPE,
    MARKETPLACE_READ_SCOPE,
    CART_READ_SCOPE,
    ORDERS_READ_SCOPE,
    IDENTITY_CART_WRITE_SCOPE,
  ]);

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
  const credentials = {
    email: 'mcp-seed@example.test',
    password: 'mcp-seed-password-at-least-32-characters',
  };
  const identity = createIdentityAuth(memoryAdapter(database), {
    baseURL: 'http://localhost:3000',
    secret: 'mcp-identity-test-secret-at-least-32-characters',
    seedAdminEmail: credentials.email,
  });
  await seedGatewayClient(identity, credentials);
  const first = await seedMcpClient(identity, credentials);
  const second = await seedMcpClient(identity, credentials);
  const context = await identity.$context;
  const clients = await context.adapter.findMany({ model: 'oauthClient' });
  const resources = await context.adapter.findMany({ model: 'oauthResource' });
  const links = await context.adapter.findMany({
    model: 'oauthClientResource',
  });

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(first.clientId, second.clientId);
  assert.deepEqual(
    clients
      .map(({ softwareId, scopes }) => ({ softwareId, scopes }))
      .sort((a, b) => a.softwareId.localeCompare(b.softwareId)),
    ['apollo-mcp', 'identity-gateway'].map((softwareId) => ({
      softwareId,
      scopes: ['openid', 'profile', ...MCP_TOOL_SCOPES],
    })),
  );
  assert.deepEqual(
    resources.map(({ identifier, allowedScopes }) => ({
      identifier,
      allowedScopes,
    })),
    [
      { identifier: IDENTITY_GATEWAY_AUDIENCE, allowedScopes: MCP_TOOL_SCOPES },
      { identifier: IDENTITY_MCP_AUDIENCE, allowedScopes: MCP_TOOL_SCOPES },
    ],
  );
  assert.equal(links.length, 4);

  const auth = await startAuthServer();
  try {
    const readOnly = await auth.issueToken(
      [GATEWAY_AUDIENCE, MCP_AUDIENCE],
      [REQUIRED_SCOPE],
    );
    await verify(readOnly, auth, MCP_AUDIENCE, [REQUIRED_SCOPE]);
    await rejects(() =>
      verify(readOnly, auth, MCP_AUDIENCE, [CART_WRITE_SCOPE]),
    );

    const mutable = await auth.issueToken(
      [GATEWAY_AUDIENCE, MCP_AUDIENCE],
      [REQUIRED_SCOPE, CART_WRITE_SCOPE],
    );
    await verify(mutable, auth, MCP_AUDIENCE, [
      REQUIRED_SCOPE,
      CART_WRITE_SCOPE,
    ]);
  } finally {
    await auth.close();
  }
});

test('AC-064: The same bearer token reaches the gateway @spec:AC-064', async () => {
  const auth = await startAuthServer();
  try {
    const bearer = await auth.issueToken([GATEWAY_AUDIENCE, MCP_AUDIENCE]);
    const atMcp = await verify(bearer, auth, MCP_AUDIENCE, [REQUIRED_SCOPE]);
    const atGateway = await verify(bearer, auth, GATEWAY_AUDIENCE, [
      REQUIRED_SCOPE,
    ]);

    assert.deepEqual(atMcp.aud, [GATEWAY_AUDIENCE, MCP_AUDIENCE]);
    assert.deepEqual(atGateway.aud, [GATEWAY_AUDIENCE, MCP_AUDIENCE]);
    assert.equal(atMcp.iss, auth.issuer);
    assert.equal(atGateway.iss, auth.issuer);
    assert.equal(atMcp.exp, atGateway.exp);
  } finally {
    await auth.close();
  }
});
