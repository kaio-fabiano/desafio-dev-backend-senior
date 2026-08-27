import { createHash, randomBytes } from 'node:crypto';

import type { Milestone7Environment } from './environment.ts';

const GATEWAY_AUDIENCE = 'https://gateway.marketplace.local';
const MCP_AUDIENCE = 'https://mcp.marketplace.local';
const BUYER_EMAIL = 'milestone-7-buyer@example.test';
const SCOPES = ['marketplace:read', 'cart:write', 'orders:read', 'mcp:tools'];

type JsonObject = Record<string, any>;

export type AcceptanceProof = {
  identity: {
    buyer: JsonObject;
    claims: JsonObject;
    gatewayAccepted: boolean;
    mcpAccepted: boolean;
  };
  card: {
    subscriptionOpenedBeforeCheckout: boolean;
    checkout: JsonObject;
    retry: JsonObject;
    event: JsonObject;
    meOrder: JsonObject;
    persistedOrder: JsonObject;
  };
  pix: {
    subscriptionOpenedBeforeCheckout: boolean;
    checkout: JsonObject;
    event: JsonObject;
    meOrder: JsonObject;
  };
  mcp: {
    directMe: JsonObject;
    toolMe: JsonObject;
    rejectionStatuses: number[];
  };
};

async function graphql(
  environment: Milestone7Environment,
  operationName: string,
  variables: JsonObject = {},
  accessToken?: string,
) {
  const documents: Record<string, string> = {
    me: 'query me { me { id email } }',
    addToCart: 'mutation addToCart($productId: ID!, $quantity: Int!) { addToCart(productId: $productId, quantity: $quantity) { id } }',
    checkout: 'mutation checkout($input: CheckoutInput!) { checkout(input: $input) { id wooOrderId status paymentMethod workflow { state } pixCode } }',
    checkoutOperation: 'query checkoutOperation($id: ID!) { checkout(id: $id) { id operationKey status } }',
  };
  const query = documents[operationName];
  if (!query) throw new Error(`Unknown E2E GraphQL operation: ${operationName}`);
  const response = await fetch(`${environment.gatewayUrl}/graphql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ query, operationName, variables }),
  });
  const payload = await response.json();
  if (!response.ok || payload.errors) throw new Error(`Gateway ${operationName} failed: ${JSON.stringify(payload)}`);
  return payload.data[operationName];
}

async function issueToken(
  environment: Milestone7Environment,
  audiences: string[],
  scopes: string[],
  cookie: string,
) {
  const clients = await fetch(`${environment.identityUrl}/oauth/clients`).then(
    (response) => response.json() as Promise<{ gateway: string }>,
  );
  const verifier = randomBytes(32).toString('base64url');
  const authorization = new URL(`${environment.identityUrl}/api/auth/oauth2/authorize`);
  const parameters = {
    client_id: clients.gateway,
    response_type: 'code',
    redirect_uri: 'http://127.0.0.1:4000/oauth/callback',
    scope: ['openid', 'profile', ...scopes].join(' '),
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    state: randomBytes(16).toString('base64url'),
  };
  for (const [name, value] of Object.entries(parameters)) authorization.searchParams.set(name, value);
  for (const audience of audiences) authorization.searchParams.append('resource', audience);
  const authorizeResponse = await fetch(authorization, { headers: { cookie } });
  const authorize = await authorizeResponse.json() as { url?: string };
  if (!authorizeResponse.ok || !authorize.url) {
    throw new Error(`OAuth authorization failed: ${JSON.stringify(authorize)}`);
  }
  const consentUrl = new URL(authorize.url, environment.identityUrl);
  const consentResponse = await fetch(`${environment.identityUrl}/api/auth/oauth2/consent`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      cookie,
      origin: 'http://identity.localhost:3001',
    },
    body: JSON.stringify({ accept: true, oauth_query: consentUrl.search.slice(1) }),
  });
  const consent = await consentResponse.json() as { url?: string };
  if (!consentResponse.ok || !consent.url) {
    throw new Error(`OAuth consent failed: ${JSON.stringify(consent)}`);
  }
  const code = new URL(consent.url).searchParams.get('code');
  if (!code) throw new Error(`OAuth consent did not return a code: ${JSON.stringify(consent)}`);
  const token = await fetch(`${environment.identityUrl}/api/auth/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clients.gateway,
      redirect_uri: parameters.redirect_uri,
      code,
      code_verifier: verifier,
    }),
  }).then((response) => response.json() as Promise<{ access_token: string }>);
  const claims = JSON.parse(Buffer.from(token.access_token.split('.')[1]!, 'base64url').toString('utf8'));
  return { accessToken: token.access_token, claims };
}

async function registerBuyer(environment: Milestone7Environment) {
  const response = await fetch(`${environment.identityUrl}/api/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'http://identity.localhost:3001' },
    body: JSON.stringify({ email: BUYER_EMAIL, password: 'milestone-7-buyer-password', name: 'Milestone 7 buyer' }),
  });
  const payload = await response.json() as { user: JsonObject };
  if (!response.ok) throw new Error(`Better Auth sign-up failed: ${JSON.stringify(payload)}`);
  return {
    buyer: payload.user,
    cookie: response.headers.getSetCookie().map((value) => value.split(';', 1)[0]).join('; '),
  };
}

async function mcpRequest(
  environment: Milestone7Environment,
  accessToken: string | undefined,
  body: JsonObject,
  sessionId?: string,
) {
  return fetch(environment.mcpUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function invokeMe(environment: Milestone7Environment, accessToken: string) {
  const initialize = await mcpRequest(environment, accessToken, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'milestone-7-e2e', version: '1.0.0' } },
  });
  if (!initialize.ok) {
    throw new Error(
      `MCP initialize failed with ${initialize.status}: ${initialize.headers.get('www-authenticate') ?? ''} ${await initialize.text()}`,
    );
  }
  const sessionId = initialize.headers.get('mcp-session-id');
  if (!sessionId) throw new Error('MCP initialize did not return a session identifier');
  const call = await mcpRequest(environment, accessToken, {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'me', arguments: {} },
  }, sessionId);
  if (!call.ok) throw new Error(`MCP me failed with ${call.status}: ${await call.text()}`);
  const responseText = await call.text();
  const jsonText = call.headers.get('content-type')?.includes('text/event-stream')
    ? responseText.split(/\r?\n/).find((line) => line.startsWith('data:') && line.slice(5).trim())?.slice(5).trim()
    : responseText;
  if (!jsonText) throw new Error(`MCP me returned no JSON-RPC message: ${responseText}`);
  const payload = JSON.parse(jsonText);
  return JSON.parse(payload.result.content[0].text).data.me;
}

async function subscribe(environment: Milestone7Environment, operationKey: string, accessToken: string) {
  const response = await fetch(`${environment.gatewayUrl}/graphql/stream?operationKey=${encodeURIComponent(operationKey)}`, {
    headers: { accept: 'text/event-stream', authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok || !response.body) throw new Error(`Gateway subscription failed with ${response.status}`);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  return async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) throw new Error(`Subscription ${operationKey} ended without an event`);
      pending += decoder.decode(value, { stream: true });
      const match = pending.match(/data: (.+)\n\n/);
      if (match) return JSON.parse(match[1]).data.orderEvents;
    }
  };
}

async function checkout(
  environment: Milestone7Environment,
  accessToken: string,
  operationKey: string,
  paymentMethod: 'CARD' | 'PIX',
) {
  const nextEvent = await subscribe(environment, operationKey, accessToken);
  const subscriptionOpenedBeforeCheckout = true;
  const result = await graphql(environment, 'checkout', { input: { operationKey, paymentMethod } }, accessToken);
  return { result, event: await nextEvent(), subscriptionOpenedBeforeCheckout };
}

export async function runAcceptanceJourney(environment: Milestone7Environment): Promise<AcceptanceProof> {
  const { buyer, cookie } = await registerBuyer(environment);
  const { accessToken, claims } = await issueToken(environment, [GATEWAY_AUDIENCE, MCP_AUDIENCE], SCOPES, cookie);
  const gatewayIdentity = await graphql(environment, 'me', {}, accessToken);
  const mcpIdentity = await invokeMe(environment, accessToken);

  await graphql(environment, 'addToCart', { productId: '1001', quantity: 1 }, accessToken);
  const cardOperationKey = 'milestone-7-card';
  const card = await checkout(environment, accessToken, cardOperationKey, 'CARD');
  const cardRetry = await graphql(environment, 'checkout', { input: { operationKey: cardOperationKey, paymentMethod: 'CARD' } }, accessToken);
  const cardPersisted = await graphql(environment, 'checkoutOperation', { id: card.result.id }, accessToken);
  const meAfterCard = await graphql(environment, 'me', {}, accessToken);

  const pixOperationKey = 'milestone-7-pix';
  const pix = await checkout(environment, accessToken, pixOperationKey, 'PIX');
  const meAfterPix = await graphql(environment, 'me', {}, accessToken);

  const gatewayOnly = await issueToken(environment, [GATEWAY_AUDIENCE], SCOPES, cookie);
  const underScoped = await issueToken(environment, [GATEWAY_AUDIENCE, MCP_AUDIENCE], ['marketplace:read'], cookie);
  const invalidRequests = [
    mcpRequest(environment, undefined, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'me', arguments: {} } }),
    mcpRequest(environment, gatewayOnly.accessToken, { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'me', arguments: {} } }),
    mcpRequest(environment, underScoped.accessToken, { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'me', arguments: {} } }),
  ];

  return {
    identity: {
      buyer,
      claims,
      gatewayAccepted: gatewayIdentity.id === buyer.id,
      mcpAccepted: mcpIdentity.id === buyer.id,
    },
    card: {
      subscriptionOpenedBeforeCheckout: card.subscriptionOpenedBeforeCheckout,
      checkout: card.result,
      retry: cardRetry,
      event: card.event,
      meOrder: meAfterCard.orders.find((order: JsonObject) => order.operationKey === cardOperationKey),
      persistedOrder: cardPersisted,
    },
    pix: {
      subscriptionOpenedBeforeCheckout: pix.subscriptionOpenedBeforeCheckout,
      checkout: pix.result,
      event: pix.event,
      meOrder: meAfterPix.orders.find((order: JsonObject) => order.operationKey === pixOperationKey),
    },
    mcp: {
      directMe: gatewayIdentity,
      toolMe: mcpIdentity,
      rejectionStatuses: await Promise.all(invalidRequests).then((responses) => responses.map(({ status }) => status)),
    },
  };
}
