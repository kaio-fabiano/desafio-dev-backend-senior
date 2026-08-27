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
  const response = await fetch(`${environment.gatewayUrl}/graphql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ operationName, variables }),
  });
  const payload = await response.json();
  if (!response.ok || payload.errors) throw new Error(`Gateway ${operationName} failed: ${JSON.stringify(payload)}`);
  return payload.data[operationName];
}

async function issueToken(
  environment: Milestone7Environment,
  audiences: string[],
  scopes: string[],
) {
  return graphql(environment, 'issueToken', { email: BUYER_EMAIL, audiences, scopes });
}

async function mcpRequest(environment: Milestone7Environment, accessToken: string | undefined, body: JsonObject) {
  return fetch(environment.mcpUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
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
  if (!initialize.ok) throw new Error(`MCP initialize failed with ${initialize.status}`);
  const call = await mcpRequest(environment, accessToken, {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: 'me', arguments: {} },
  });
  if (!call.ok) throw new Error(`MCP me failed with ${call.status}`);
  const payload = await call.json();
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
  const result = await graphql(environment, 'checkout', { operationKey, paymentMethod }, accessToken);
  return { result, event: await nextEvent(), subscriptionOpenedBeforeCheckout };
}

export async function runAcceptanceJourney(environment: Milestone7Environment): Promise<AcceptanceProof> {
  const buyer = await graphql(environment, 'registerBuyer', { email: BUYER_EMAIL });
  const { accessToken, claims } = await issueToken(environment, [GATEWAY_AUDIENCE, MCP_AUDIENCE], SCOPES);
  const gatewayIdentity = await graphql(environment, 'me', {}, accessToken);
  const mcpIdentity = await invokeMe(environment, accessToken);

  await graphql(environment, 'addToCart', { productId: 'product-1', quantity: 1 }, accessToken);
  const cardOperationKey = 'milestone-7-card';
  const card = await checkout(environment, accessToken, cardOperationKey, 'CARD');
  const cardRetry = await graphql(environment, 'checkout', { operationKey: cardOperationKey, paymentMethod: 'CARD' }, accessToken);
  const cardPersisted = await graphql(environment, 'order', { operationKey: cardOperationKey }, accessToken);
  const meAfterCard = await graphql(environment, 'me', {}, accessToken);

  const pixOperationKey = 'milestone-7-pix';
  const pix = await checkout(environment, accessToken, pixOperationKey, 'PIX');
  const meAfterPix = await graphql(environment, 'me', {}, accessToken);

  const gatewayOnly = await issueToken(environment, [GATEWAY_AUDIENCE], SCOPES);
  const underScoped = await issueToken(environment, [GATEWAY_AUDIENCE, MCP_AUDIENCE], ['marketplace:read']);
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
