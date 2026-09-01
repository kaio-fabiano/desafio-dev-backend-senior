import { createHash, randomBytes } from 'node:crypto';

import type { Milestone7Environment } from './environment.ts';

const GATEWAY_AUDIENCE = 'https://gateway.marketplace.local';
const MCP_AUDIENCE = 'https://mcp.marketplace.local';
const BUYER_EMAIL = 'milestone-7-buyer@example.test';
const BUYER_PASSWORD = ['milestone', '7', 'buyer', 'password'].join('-');
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
    products: JsonObject[];
  };
  pix: {
    subscriptionOpenedBeforeCheckout: boolean;
    checkout: JsonObject;
    event: JsonObject;
    meOrder: JsonObject;
    products: JsonObject[];
  };
  compensation: {
    checkout: JsonObject;
    event: JsonObject;
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
  sessionHeaders: Record<string, string> = {},
) {
  const documents: Record<string, { query: string; responseField?: string }> = {
    me: { query: 'query me { me { id email } }', responseField: 'me' },
    meOrdersAndProducts: {
      query:
        'query meOrdersAndProducts { me { id email orders(first: 20) { edges { node { id wooOrderId paymentMethod workflow { state } pixCode } } } } products(first: 20) { nodes { id databaseId name sku ... on SimpleProduct { stockQuantity } ... on VariableProduct { stockQuantity } } } }',
      responseField: undefined,
    },
    addToCart: {
      query:
        'mutation addToCart($productId: Int!, $quantity: Int!) { addToCart(input: { productId: $productId, quantity: $quantity }) { cart { contents { nodes { key quantity } } } } }',
      responseField: 'addToCart',
    },
    startCheckout: {
      query:
        'mutation startCheckout($input: OrderWorkflowCheckoutInput!) { startCheckout(input: $input) { id wooOrderId paymentMethod workflow { state } pixCode } }',
      responseField: 'startCheckout',
    },
  };
  const document = documents[operationName];
  if (!document)
    throw new Error(`Unknown E2E GraphQL operation: ${operationName}`);
  const response = await fetch(`${environment.gatewayUrl}/graphql`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...sessionHeaders,
    },
    body: JSON.stringify({ query: document.query, operationName, variables }),
  });
  const payload = await response.json();
  if (
    !response.ok ||
    payload.errors ||
    !payload.data ||
    (document.responseField && payload.data[document.responseField] == null)
  ) {
    throw new Error(
      `Gateway ${operationName} failed: ${JSON.stringify(payload)}`,
    );
  }
  for (const name of ['woocommerce-session', 'cart-token']) {
    const value = response.headers.get(name);
    if (value) {
      sessionHeaders[name] =
        name === 'woocommerce-session' && !value.startsWith('Session ')
          ? `Session ${value}`
          : value;
    }
  }
  const cookies = response.headers
    .getSetCookie()
    .map((value) => value.split(';', 1)[0])
    .filter(Boolean);
  if (cookies.length > 0) sessionHeaders.cookie = cookies.join('; ');
  return document.responseField
    ? payload.data[document.responseField]
    : payload.data;
}

async function issueToken(
  environment: Milestone7Environment,
  audiences: string[],
  scopes: string[],
  cookie: string,
) {
  let sessionCookie = cookie;
  const clients = await fetch(`${environment.identityUrl}/oauth/clients`).then(
    (response) => response.json() as Promise<{ gateway: string }>,
  );
  const verifier = randomBytes(32).toString('base64url');
  const authorization = new URL(
    `${environment.identityUrl}/api/auth/oauth2/authorize`,
  );
  const parameters = {
    client_id: clients.gateway,
    response_type: 'code',
    redirect_uri: 'http://127.0.0.1:4000/oauth/callback',
    scope: ['openid', 'profile', ...scopes].join(' '),
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
    state: randomBytes(16).toString('base64url'),
  };
  for (const [name, value] of Object.entries(parameters))
    authorization.searchParams.set(name, value);
  for (const audience of audiences)
    authorization.searchParams.append('resource', audience);
  const authorizeResponse = await fetch(authorization, {
    headers: { cookie: sessionCookie },
  });
  sessionCookie = mergeResponseCookies(sessionCookie, authorizeResponse);
  const authorize = (await authorizeResponse.json()) as { url?: string };
  if (!authorizeResponse.ok || !authorize.url) {
    throw new Error(`OAuth authorization failed: ${JSON.stringify(authorize)}`);
  }
  const next = classifyAuthorizationResult(
    authorize.url,
    environment.identityUrl,
  );
  let code: string;
  if (next.kind === 'code') {
    code = next.code;
  } else {
    const consentResponse = await fetch(
      `${environment.identityUrl}/api/auth/oauth2/consent`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          cookie: sessionCookie,
          origin: 'http://identity.localhost:3001',
        },
        body: JSON.stringify({ accept: true, oauth_query: next.oauthQuery }),
      },
    );
    sessionCookie = mergeResponseCookies(sessionCookie, consentResponse);
    const consent = (await consentResponse.json()) as { url?: string };
    if (!consentResponse.ok || !consent.url) {
      throw new Error(`OAuth consent failed: ${JSON.stringify(consent)}`);
    }
    const consentCode = new URL(consent.url).searchParams.get('code');
    if (!consentCode) {
      throw new Error(
        `OAuth consent did not return a code: ${JSON.stringify(consent)}`,
      );
    }
    code = consentCode;
  }
  const tokenResponse = await fetch(
    `${environment.identityUrl}/api/auth/oauth2/token`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clients.gateway,
        redirect_uri: parameters.redirect_uri,
        code,
        code_verifier: verifier,
      }),
    },
  );
  sessionCookie = mergeResponseCookies(sessionCookie, tokenResponse);
  const token = (await tokenResponse.json()) as { access_token: string };
  const claims = JSON.parse(
    Buffer.from(token.access_token.split('.')[1]!, 'base64url').toString(
      'utf8',
    ),
  );
  return { accessToken: token.access_token, claims, cookie: sessionCookie };
}

export function classifyAuthorizationResult(
  url: string,
  baseUrl: string,
): { kind: 'code'; code: string } | { kind: 'consent'; oauthQuery: string } {
  const result = new URL(url, baseUrl);
  const code = result.searchParams.get('code');
  if (code) return { kind: 'code', code };
  const oauthQuery = result.search.slice(1);
  if (!oauthQuery)
    throw new Error(
      'OAuth authorization returned neither code nor consent query',
    );
  return { kind: 'consent', oauthQuery };
}

export function mergeResponseCookies(
  cookie: string,
  response: Response,
): string {
  const values = new Map<string, string>();
  for (const part of cookie
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)) {
    const separator = part.indexOf('=');
    if (separator > 0)
      values.set(part.slice(0, separator), part.slice(separator + 1));
  }
  for (const setCookie of response.headers.getSetCookie()) {
    const [pair] = setCookie.split(';', 1);
    const separator = pair.indexOf('=');
    if (separator < 1) continue;
    const name = pair.slice(0, separator);
    const expires = /(?:^|;)\s*expires=([^;]+)/i.exec(setCookie)?.[1];
    if (
      /(?:^|;)\s*max-age=0(?:;|$)/i.test(setCookie) ||
      (expires && Date.parse(expires) <= Date.now())
    ) {
      values.delete(name);
    } else {
      values.set(name, pair.slice(separator + 1));
    }
  }
  return [...values].map(([name, value]) => `${name}=${value}`).join('; ');
}

async function registerBuyer(environment: Milestone7Environment) {
  const response = await fetch(
    `${environment.identityUrl}/api/auth/sign-up/email`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://identity.localhost:3001',
      },
      body: JSON.stringify({
        email: BUYER_EMAIL,
        password: BUYER_PASSWORD,
        name: 'Milestone 7 buyer',
      }),
    },
  );
  const payload = (await response.json()) as { user: JsonObject };
  if (!response.ok)
    throw new Error(`Better Auth sign-up failed: ${JSON.stringify(payload)}`);
  return {
    buyer: payload.user,
    cookie: response.headers
      .getSetCookie()
      .map((value) => value.split(';', 1)[0])
      .join('; '),
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

async function invokeMe(
  environment: Milestone7Environment,
  accessToken: string,
) {
  const initialize = await mcpRequest(environment, accessToken, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'milestone-7-e2e', version: '1.0.0' },
    },
  });
  if (!initialize.ok) {
    throw new Error(
      `MCP initialize failed with ${initialize.status}: ${initialize.headers.get('www-authenticate') ?? ''} ${await initialize.text()}`,
    );
  }
  const sessionId = initialize.headers.get('mcp-session-id');
  if (!sessionId)
    throw new Error('MCP initialize did not return a session identifier');
  const call = await mcpRequest(
    environment,
    accessToken,
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'me', arguments: {} },
    },
    sessionId,
  );
  if (!call.ok)
    throw new Error(`MCP me failed with ${call.status}: ${await call.text()}`);
  const responseText = await call.text();
  const jsonText = call.headers
    .get('content-type')
    ?.includes('text/event-stream')
    ? responseText
        .split(/\r?\n/)
        .find((line) => line.startsWith('data:') && line.slice(5).trim())
        ?.slice(5)
        .trim()
    : responseText;
  if (!jsonText)
    throw new Error(`MCP me returned no JSON-RPC message: ${responseText}`);
  const payload = JSON.parse(jsonText);
  return JSON.parse(payload.result.content[0].text).data.me;
}

async function subscribe(
  environment: Milestone7Environment,
  operationKey: string,
  terminalState: 'COMPLETED' | 'PIX_GENERATED' | 'CANCELLED',
  accessToken: string,
) {
  const stream = await fetch(`${environment.gatewayUrl}/graphql/stream`, {
    method: 'POST',
    headers: {
      accept: 'text/event-stream',
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      query:
        'subscription orderEvents($operationKey: ID!) { orderEvents(operationKey: $operationKey) { operationKey orderId state pixCode eventTime } }',
      variables: { operationKey },
    }),
  });
  if (!stream.ok || !stream.body)
    throw new Error(`Gateway subscription failed with ${stream.status}`);
  return () => readTerminalEvent(stream, operationKey, terminalState);
}

export async function readTerminalEvent(
  stream: Response,
  operationKey: string,
  terminalState: string,
) {
  if (!stream.body) throw new Error('Subscription response has no body');
  const reader = stream.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  const observedStates: string[] = [];
  while (true) {
    const { done, value } = await reader.read();
    pending += decoder.decode(value, { stream: !done });
    for (
      let delimiter = pending.match(/\r?\n\r?\n/);
      delimiter?.index !== undefined;
      delimiter = pending.match(/\r?\n\r?\n/)
    ) {
      const frame = pending.slice(0, delimiter.index);
      pending = pending.slice(delimiter.index + delimiter[0].length);
      const data = frame
        .split(/\r?\n/)
        .find((line) => line.startsWith('data:'))
        ?.slice(5)
        .trim();
      if (!data) continue;
      const payload = JSON.parse(data);
      if (payload.errors)
        throw new Error(`Subscription ${operationKey} failed: ${data}`);
      const event = payload.data?.orderEvents;
      if (typeof event?.state === 'string') observedStates.push(event.state);
      if (event?.state === terminalState) return event;
    }
    if (done)
      throw new Error(
        `Subscription ${operationKey} ended without ${terminalState}; observed ${observedStates.join(', ') || 'no states'}`,
      );
  }
}

async function checkout(
  environment: Milestone7Environment,
  accessToken: string,
  operationKey: string,
  paymentMethod: 'CARD' | 'PIX',
  commerceSession: Record<string, string>,
  expectedTerminalState?: 'COMPLETED' | 'PIX_GENERATED' | 'CANCELLED',
) {
  const terminalState =
    expectedTerminalState ??
    (paymentMethod === 'CARD' ? 'COMPLETED' : 'PIX_GENERATED');
  const nextEvent = await subscribe(
    environment,
    operationKey,
    terminalState,
    accessToken,
  );
  const subscriptionOpenedBeforeCheckout = true;
  const checkoutResult = await graphql(
    environment,
    'startCheckout',
    { input: { operationKey, paymentMethod } },
    accessToken,
    commerceSession,
  );
  return {
    checkout: checkoutResult,
    event: await nextEvent(),
    subscriptionOpenedBeforeCheckout,
  };
}

async function setProductStock(
  environment: Milestone7Environment,
  quantity: number,
) {
  const credentials = Buffer.from(
    'ck_3333333333333333333333333333333333333333:cs_3333333333333333333333333333333333333333',
  ).toString('base64');
  const response = await fetch(
    `${environment.wordpressUrl}/wp-json/wc/v3/products/1001`,
    {
      method: 'PUT',
      headers: {
        authorization: `Basic ${credentials}`,
        'content-type': 'application/json',
        'x-forwarded-proto': 'https',
      },
      body: JSON.stringify({ stock_quantity: quantity }),
    },
  );
  if (!response.ok)
    throw new Error(`WooCommerce stock setup failed with ${response.status}`);
}

export async function runAcceptanceJourney(
  environment: Milestone7Environment,
): Promise<AcceptanceProof> {
  const registration = await registerBuyer(environment);
  const { buyer } = registration;
  let cookie = registration.cookie;
  const primaryGrant = await issueToken(
    environment,
    [GATEWAY_AUDIENCE, MCP_AUDIENCE],
    SCOPES,
    cookie,
  );
  const { accessToken, claims } = primaryGrant;
  cookie = primaryGrant.cookie;
  const gatewayIdentity = await graphql(environment, 'me', {}, accessToken);
  const mcpIdentity = await invokeMe(environment, accessToken);

  const commerceSession: Record<string, string> = {};
  await graphql(
    environment,
    'addToCart',
    { productId: 1001, quantity: 1 },
    accessToken,
    commerceSession,
  );
  const cardOperationKey = 'milestone-7-card';
  const card = await checkout(
    environment,
    accessToken,
    cardOperationKey,
    'CARD',
    commerceSession,
  );
  const cardRetry = await graphql(
    environment,
    'startCheckout',
    { input: { operationKey: cardOperationKey, paymentMethod: 'CARD' } },
    accessToken,
    commerceSession,
  );
  const meAfterCard = await graphql(
    environment,
    'meOrdersAndProducts',
    {},
    accessToken,
  );

  const pixOperationKey = 'milestone-7-pix';
  await graphql(
    environment,
    'addToCart',
    { productId: 1001, quantity: 1 },
    accessToken,
    commerceSession,
  );
  const pix = await checkout(
    environment,
    accessToken,
    pixOperationKey,
    'PIX',
    commerceSession,
  );
  await graphql(
    environment,
    'addToCart',
    { productId: 1001, quantity: 1 },
    accessToken,
    commerceSession,
  );
  await setProductStock(environment, 0);
  let compensation;
  try {
    compensation = await checkout(
      environment,
      accessToken,
      'milestone-7-compensation',
      'CARD',
      commerceSession,
      'CANCELLED',
    );
  } finally {
    await setProductStock(environment, 100);
  }
  const meAfterPix = await graphql(
    environment,
    'meOrdersAndProducts',
    {},
    accessToken,
  );

  const gatewayOnly = await issueToken(
    environment,
    [GATEWAY_AUDIENCE],
    SCOPES,
    cookie,
  );
  cookie = gatewayOnly.cookie;
  const underScoped = await issueToken(
    environment,
    [GATEWAY_AUDIENCE, MCP_AUDIENCE],
    ['marketplace:read'],
    cookie,
  );
  const invalidRequests = [
    mcpRequest(environment, undefined, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'me', arguments: {} },
    }),
    mcpRequest(environment, gatewayOnly.accessToken, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'me', arguments: {} },
    }),
    mcpRequest(environment, underScoped.accessToken, {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'me', arguments: {} },
    }),
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
      checkout: card.checkout,
      retry: cardRetry,
      event: card.event,
      meOrder: meAfterCard.me.orders.edges.find(
        ({ node }: JsonObject) => node.wooOrderId === card.checkout.wooOrderId,
      )?.node,
      products: meAfterCard.products.nodes,
    },
    pix: {
      subscriptionOpenedBeforeCheckout: pix.subscriptionOpenedBeforeCheckout,
      checkout: pix.checkout,
      event: pix.event,
      meOrder: meAfterPix.me.orders.edges.find(
        ({ node }: JsonObject) => node.wooOrderId === pix.checkout.wooOrderId,
      )?.node,
      products: meAfterPix.products.nodes,
    },
    compensation: {
      checkout: compensation.checkout,
      event: compensation.event,
    },
    mcp: {
      directMe: gatewayIdentity,
      toolMe: mcpIdentity,
      rejectionStatuses: await Promise.all(invalidRequests).then((responses) =>
        responses.map(({ status }) => status),
      ),
    },
  };
}
