import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { test } from 'node:test';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { oauthProviderResourceClient } from '@better-auth/oauth-provider/resource-client';
import { createAuthClient } from 'better-auth/client';

import {
  CART_WRITE_SCOPE,
  GATEWAY_AUDIENCE,
  MCP_AUDIENCE,
  REQUIRED_SCOPE,
  startAuthServer,
} from './fixtures/auth-server.ts';

const expectedTools = [
  'addToCart',
  'getMyCart',
  'getMyOrders',
  'getProduct',
  'me',
  'searchProducts',
];
const buyer = { id: 'buyer-mcp', email: 'buyer-mcp@example.test' };
const client = createAuthClient({ plugins: [oauthProviderResourceClient()] });

test('AC-060: Only approved operations become tools @spec:AC-060', async () => {
  await withFixture([REQUIRED_SCOPE, CART_WRITE_SCOPE], async ({ connect }) => {
    const mcp = await connect();
    try {
      assert.deepEqual(
        (await mcp.listTools()).tools.map(({ name }) => name).sort(),
        expectedTools,
      );
    } finally {
      await mcp.close();
    }
  });
});

test('AC-061: Forbidden mutations cannot be invoked @spec:AC-061', async () => {
  await withFixture([REQUIRED_SCOPE, CART_WRITE_SCOPE], async ({ connect }) => {
    const mcp = await connect();
    try {
      for (const name of ['checkout', 'payment', 'administration', 'registerSupplier', 'createProduct', 'execute']) {
        await assert.rejects(mcp.callTool({ name, arguments: {} }));
      }
    } finally {
      await mcp.close();
    }
  });
});

test('AC-062: Invalid MCP authentication is rejected @spec:AC-062', async () => {
  const auth = await startAuthServer({ m2mAccessTokenExpiresIn: 1 });
  const foreign = await startAuthServer();
  const expired = await auth.issueToken([MCP_AUDIENCE]);
  const gatewayOnly = await auth.issueToken([GATEWAY_AUDIENCE]);
  const wrongIssuer = await foreign.issueToken([MCP_AUDIENCE]);
  await new Promise((resolve) => setTimeout(resolve, 1_100));
  const fixture = await createFixture(auth, new Map());
  try {
    for (const token of ['', expired, gatewayOnly, wrongIssuer]) {
      await assert.rejects(fixture.connect(token), /401|Unauthorized|authentication/i);
    }
    const response = await fetch(fixture.url, {
      method: 'POST',
      headers: { accept: 'application/json, text/event-stream', 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    });
    assert.equal(response.status, 401);
    assert.match(response.headers.get('www-authenticate') ?? '', /resource_metadata=/);
    assert.equal(fixture.gateway.operations.length, 0);
  } finally {
    await fixture.close();
    await foreign.close();
    await auth.close();
  }
});

test('AC-063: Tool scopes are enforced @spec:AC-063', async () => {
  await withFixture([REQUIRED_SCOPE], async ({ connect, gateway }) => {
    const mcp = await connect();
    try {
      const read = await mcp.callTool({ name: 'searchProducts', arguments: { first: 20 } });
      assert.notEqual(read.isError, true);
      const mutation = await mcp.callTool({ name: 'addToCart', arguments: { productId: 'product-1', quantity: 1 } });
      assert.equal(mutation.isError, true);
      assert.match(mutation.content[0].text, /cart:write/);
      assert.deepEqual(gateway.operations, ['searchProducts']);
    } finally {
      await mcp.close();
    }
  });

  await withFixture([REQUIRED_SCOPE, CART_WRITE_SCOPE], async ({ connect, gateway }) => {
    const mcp = await connect();
    try {
      const mutation = await mcp.callTool({ name: 'addToCart', arguments: { productId: 'product-1', quantity: 1 } });
      assert.notEqual(mutation.isError, true);
      assert.deepEqual(gateway.operations, ['addToCart']);
    } finally {
      await mcp.close();
    }
  });
});

test('AC-064: The same bearer token reaches the gateway @spec:AC-064', async () => {
  await withFixture([REQUIRED_SCOPE, CART_WRITE_SCOPE], async ({ connect, token, gateway }) => {
    const mcp = await connect();
    try {
      await mcp.callTool({ name: 'me', arguments: {} });
      assert.deepEqual(gateway.authorizationHeaders, [`Bearer ${token}`]);
      assert.equal(gateway.validations, 1);
    } finally {
      await mcp.close();
    }
  });
});

test('AC-065: MCP and GraphQL return the same buyer view @spec:AC-065', async () => {
  await withFixture([REQUIRED_SCOPE], async ({ connect, token, gateway }) => {
    const direct = await fetch(gateway.url, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ operationName: 'me' }),
    }).then((response) => response.json());
    const mcp = await connect();
    try {
      const result = await mcp.callTool({ name: 'me', arguments: {} });
      assert.deepEqual(JSON.parse(result.content[0].text).data.me, direct.data.me);
      assert.deepEqual(direct.data.me, buyer);
    } finally {
      await mcp.close();
    }
  });
});

test('AC-066: Milestone acceptance is reproducible @spec:AC-066', async () => {
  await withFixture([REQUIRED_SCOPE, CART_WRITE_SCOPE], async ({ connect, token, gateway, logs }) => {
    const mcp = await connect();
    try {
      assert.deepEqual((await mcp.listTools()).tools.map(({ name }) => name).sort(), expectedTools);
      await mcp.callTool({ name: 'me', arguments: {} });
      await mcp.callTool({ name: 'searchProducts', arguments: { first: 20 } });
      await mcp.callTool({ name: 'addToCart', arguments: { productId: 'product-1', quantity: 1 } });
      assert.deepEqual(gateway.authorizationHeaders, [`Bearer ${token}`, `Bearer ${token}`, `Bearer ${token}`]);
      assert.ok(logs.every((entry) => !entry.includes(token)), 'probe logs must redact bearer tokens');
    } finally {
      await mcp.close();
    }
  });
});

async function withFixture(scopes, action) {
  const auth = await startAuthServer();
  const token = await auth.issueToken([GATEWAY_AUDIENCE, MCP_AUDIENCE], scopes);
  const fixture = await createFixture(auth, new Map([[token, new Set(scopes)]]));
  try {
    await action({ ...fixture, token, connect: () => fixture.connect(token) });
  } finally {
    await fixture.close();
    await auth.close();
  }
}

async function createFixture(auth, scopesByToken) {
  const gateway = await gatewayFixture(auth);
  const sessions = new Map();
  const logs = [];
  const server = createServer(async (request, response) => {
    const authorization = request.headers.authorization ?? '';
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    try {
      await client.verifyAccessTokenRequest(new Request(MCP_AUDIENCE, { headers: authorization ? { authorization } : {} }), {
        jwksUrl: auth.jwksUrl,
        verifyOptions: { issuer: auth.issuer, audience: MCP_AUDIENCE },
        requiredScopes: [REQUIRED_SCOPE],
      });
      if (!scopesByToken.has(token)) throw new Error('Unknown test token');
    } catch {
      response.writeHead(401, {
        'content-type': 'application/json',
        'www-authenticate': `Bearer resource_metadata="http://${request.headers.host}/.well-known/oauth-protected-resource"`,
      });
      response.end(JSON.stringify({ error: 'invalid_token' }));
      return;
    }

    const chunks = [];
    for await (const chunk of request) chunks.push(Buffer.from(chunk));
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : undefined;
    const sessionId = request.headers['mcp-session-id'];
    let session = typeof sessionId === 'string' ? sessions.get(sessionId) : undefined;
    if (!session && request.method === 'POST' && isInitializeRequest(body)) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => crypto.randomUUID(),
        enableJsonResponse: true,
        onsessioninitialized: (id) => sessions.set(id, { transport, server: mcp }),
      });
      const mcp = registeredMcp({ token, scopes: scopesByToken.get(token), gateway, logs });
      session = { transport, server: mcp };
      await mcp.connect(transport);
    }
    if (!session) {
      response.writeHead(400).end('Invalid MCP session');
      return;
    }
    await session.transport.handleRequest(request, response, body);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('MCP test server did not bind');
  const url = `http://127.0.0.1:${address.port}/mcp`;
  return {
    url,
    gateway,
    logs,
    connect: async (token) => {
      const mcp = new Client({ name: 'milestone-6-probe', version: '1.0.0' });
      await mcp.connect(new StreamableHTTPClientTransport(new URL(url), {
        requestInit: { headers: token ? { authorization: `Bearer ${token}` } : {} },
      }));
      return mcp;
    },
    close: () => Promise.all([...sessions.values()].map(({ server: item }) => item.close())).then(() => close(server)).then(() => gateway.close()),
  };
}

function registeredMcp({ token, scopes, gateway, logs }) {
  const mcp = new McpServer({ name: 'apollo-mcp-acceptance-probe', version: '1.17.0' });
  const requiredScopes = {
    me: REQUIRED_SCOPE,
    searchProducts: REQUIRED_SCOPE,
    getProduct: REQUIRED_SCOPE,
    getMyCart: 'cart:read',
    getMyOrders: 'orders:read',
    addToCart: CART_WRITE_SCOPE,
  };
  for (const [name, scope] of Object.entries(requiredScopes)) {
    mcp.registerTool(name, {}, async (arguments_) => {
      if (!scopes.has(scope)) return { isError: true, content: [{ type: 'text', text: `Forbidden: ${scope} is required` }] };
      logs.push(`tool=${name}`);
      const response = await fetch(gateway.url, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ operationName: name, variables: arguments_ }),
      });
      return { content: [{ type: 'text', text: JSON.stringify(await response.json()) }] };
    });
  }
  return mcp;
}

async function gatewayFixture(auth) {
  const authorizationHeaders = [];
  const operations = [];
  let validations = 0;
  const server = createServer(async (request, response) => {
    const authorization = request.headers.authorization ?? '';
    try {
      await client.verifyAccessTokenRequest(new Request(GATEWAY_AUDIENCE, { headers: authorization ? { authorization } : {} }), {
        jwksUrl: auth.jwksUrl,
        verifyOptions: { issuer: auth.issuer, audience: GATEWAY_AUDIENCE },
        requiredScopes: [REQUIRED_SCOPE],
      });
      validations += 1;
      authorizationHeaders.push(authorization);
      const chunks = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const { operationName } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      operations.push(operationName);
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ data: operationName === 'me' ? { me: buyer } : { [operationName]: { ok: true } } }));
    } catch {
      response.writeHead(401).end(JSON.stringify({ errors: [{ message: 'Unauthorized' }] }));
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Gateway test server did not bind');
  return { url: `http://127.0.0.1:${address.port}/graphql`, authorizationHeaders, operations, get validations() { return validations; }, close: () => close(server) };
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
