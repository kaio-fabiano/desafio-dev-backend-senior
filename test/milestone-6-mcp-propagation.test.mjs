import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { test } from 'node:test';

import { createGatewayAuthMiddleware } from '../apps/gateway/src/main.ts';
import { verifyGatewayRequest } from '../apps/gateway/src/auth/token-verifier.ts';

const bearer = 'Bearer opaque-multi-audience-token';
const issuer = 'https://identity.marketplace.test/api/auth';
const audience = 'https://gateway.marketplace.local';
const now = 2_000_000_000;
const buyer = { id: 'buyer-a', email: 'buyer-a@example.test' };
const claims = {
  sub: buyer.id,
  iss: issuer,
  aud: [audience, 'https://mcp.marketplace.local'],
  exp: now + 60,
  scope: 'marketplace:read',
};
const token = {
  issuer,
  audience,
  requiredScopes: ['marketplace:read'],
  now: () => now * 1000,
};

test('AC-064: The same bearer token reaches the gateway @spec:AC-064', async () => {
  const [config, compose, gatewayMain] = await Promise.all([
    readFile('apps/apollo-mcp/mcp.yaml', 'utf8'),
    readFile('compose.yaml', 'utf8'),
    readFile('apps/gateway/src/main.ts', 'utf8'),
  ]);
  assert.match(config, /^endpoint: http:\/\/gateway:3000\/graphql$/m);
  assert.match(config, /disable_auth_token_passthrough: false/);
  assert.doesNotMatch(config, /forward_headers:[\s\S]*authorization/i);
  assert.match(
    config,
    /health_check:\n  enabled: true\n  path: \/health\n  readiness:/,
  );
  assert.match(
    compose,
    /apollo-mcp:\n    build:[\s\S]*dockerfile: apps\/apollo-mcp\/Dockerfile/,
  );
  assert.match(compose, /gateway:\n        condition: service_healthy/);
  assert.doesNotMatch(
    gatewayMain,
    /console\.(?:log|info|warn|error)\([^\n]*authorization/i,
  );

  const gateway = await gatewayHarness();
  const mcp = await mcpHarness(gateway.url);
  try {
    await invokeMeTool(mcp.url, bearer);
    assert.deepEqual(gateway.authorizationHeaders, [bearer]);
    assert.equal(gateway.verifications, 1);

    await assert.rejects(invokeMeTool(mcp.url, `${bearer}-changed`));
    assert.equal(gateway.verifications, 2);
  } finally {
    await mcp.close();
    await gateway.close();
  }
});

test('AC-065: MCP and GraphQL return the same buyer view @spec:AC-065', async () => {
  const gateway = await gatewayHarness();
  const mcp = await mcpHarness(gateway.url);
  try {
    const direct = await graphql(gateway.url, bearer).then((response) =>
      response.json(),
    );
    const throughMcp = await invokeMeTool(mcp.url, bearer);

    assert.deepEqual(throughMcp.data.me, direct.data.me);
    assert.deepEqual(direct.data.me, buyer);
    assert.deepEqual(gateway.authorizationHeaders, [bearer, bearer]);
  } finally {
    await mcp.close();
    await gateway.close();
  }
});

async function gatewayHarness() {
  let verifications = 0;
  const authorizationHeaders = [];
  const middleware = createGatewayAuthMiddleware(token, (request, options) => {
    verifications += 1;
    authorizationHeaders.push(request.headers.get('authorization'));
    return verifyGatewayRequest(request, {
      ...options,
      verify: async (verifiedRequest) => {
        if (verifiedRequest.headers.get('authorization') !== bearer) {
          throw new Error('Invalid access token');
        }
        return claims;
      },
    });
  });
  const server = createServer((request, response) => {
    void middleware(request, response, () => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ data: { me: buyer } }));
    });
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Gateway did not bind');

  return {
    authorizationHeaders,
    get verifications() {
      return verifications;
    },
    url: `http://127.0.0.1:${address.port}/graphql`,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

async function mcpHarness(gatewayUrl) {
  const server = createServer(async (request, response) => {
    const upstream = await graphql(
      gatewayUrl,
      request.headers.authorization ?? '',
    );
    response.writeHead(upstream.status, { 'content-type': 'application/json' });
    response.end(await upstream.text());
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('MCP did not bind');

  return {
    url: `http://127.0.0.1:${address.port}/mcp`,
    close: () =>
      new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      ),
  };
}

function graphql(url, authorization) {
  return fetch(url, {
    method: 'POST',
    headers: { authorization, 'content-type': 'application/json' },
    body: JSON.stringify({ query: 'query me { me { id email } }' }),
  });
}

async function invokeMeTool(mcpUrl, authorization) {
  const response = await fetch(mcpUrl, {
    method: 'POST',
    headers: { authorization, 'content-type': 'application/json' },
    body: JSON.stringify({ method: 'tools/call', params: { name: 'me' } }),
  });
  if (!response.ok) throw new Error(`MCP tool failed with ${response.status}`);
  return response.json();
}
