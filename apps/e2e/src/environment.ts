import {
  GenericContainer,
  Network,
  Wait,
  type StartedNetwork,
  type StartedTestContainer,
} from 'testcontainers';

const STARTUP_TIMEOUT = 180_000;
const NODE_IMAGE = 'node:24.19.0-bookworm-slim';

const SERVICE_SOURCE = String.raw`
const http = require('node:http');
const crypto = require('node:crypto');

const role = process.env.ROLE;
const port = Number(process.env.PORT);
const users = new Map();
const carts = new Map();
const operations = new Map();
const payments = new Map();
const subscriptions = new Map();

function send(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(value));
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
}

function stable(value) {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);
}

function claimsFrom(request) {
  const authorization = request.headers.authorization || '';
  if (!authorization.startsWith('Bearer e2e.')) throw Object.assign(new Error('Unauthorized'), { status: 401 });
  try {
    return JSON.parse(Buffer.from(authorization.slice(11), 'base64url').toString('utf8'));
  } catch {
    throw Object.assign(new Error('Unauthorized'), { status: 401 });
  }
}

function authorize(request, audience, scopes) {
  const claims = claimsFrom(request);
  if (!claims.aud.includes(audience)) throw Object.assign(new Error('Wrong audience'), { status: 401 });
  const granted = new Set(claims.scope);
  if (scopes.some((scope) => !granted.has(scope))) throw Object.assign(new Error('Insufficient scope'), { status: 403 });
  return claims;
}

async function post(url, value, authorization) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) },
    body: JSON.stringify(value),
  });
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.error || 'Upstream request failed'), { status: response.status });
  return result;
}

function publish(operationKey, order) {
  const listeners = subscriptions.get(operationKey) || [];
  for (const response of listeners) {
    response.write('event: next\ndata: ' + JSON.stringify({ data: { orderEvents: order } }) + '\n\n');
    response.end();
  }
  subscriptions.delete(operationKey);
}

async function identity(request, response, pathname) {
  const input = await readBody(request);
  if (pathname === '/register') {
    const user = {
      id: 'buyer-' + stable(input.email),
      email: input.email,
      emailAccountId: 'email-' + stable(input.email),
      wordpressAccountId: 'wp-' + stable(input.email),
    };
    users.set(user.email, user);
    return send(response, 201, user);
  }
  if (pathname === '/token') {
    const user = users.get(input.email);
    if (!user) return send(response, 401, { error: 'Unknown buyer' });
    const claims = { sub: user.id, email: user.email, aud: input.audiences, scope: input.scopes };
    return send(response, 200, { accessToken: 'e2e.' + Buffer.from(JSON.stringify(claims)).toString('base64url'), claims });
  }
  return send(response, 404, { error: 'Not found' });
}

async function catalog(response, pathname) {
  if (pathname === '/product') return send(response, 200, { id: 'product-1', name: 'Acceptance product', price: 1299 });
  return send(response, 404, { error: 'Not found' });
}

async function payment(request, response, pathname) {
  if (pathname !== '/charge') return send(response, 404, { error: 'Not found' });
  const input = await readBody(request);
  let payment = payments.get(input.operationKey);
  if (!payment) {
    payment = input.paymentMethod === 'PIX'
      ? { id: 'payment-' + stable(input.operationKey), status: 'PIX_GENERATED', pixCode: 'PIX-' + stable(input.operationKey), chargeCount: 1 }
      : { id: 'payment-' + stable(input.operationKey), status: 'APPROVED', pixCode: null, chargeCount: 1 };
    payments.set(input.operationKey, payment);
  }
  return send(response, 200, payment);
}

async function commerce(request, response, pathname) {
  const input = await readBody(request);
  if (pathname === '/cart/add') {
    const cart = { id: 'cart-' + stable(input.subject), items: [{ productId: input.productId, quantity: input.quantity }] };
    carts.set(input.subject, cart);
    return send(response, 200, cart);
  }
  if (pathname === '/checkout') {
    const key = input.subject + ':' + input.operationKey;
    let order = operations.get(key);
    if (!order) {
      const product = await fetch('http://catalog-subgraph:3002/product').then((item) => item.json());
      const paymentResult = await post('http://payment-processor:8080/charge', input);
      order = {
        id: 'order-' + stable(key),
        operationKey: input.operationKey,
        product,
        status: paymentResult.status,
        pixCode: paymentResult.pixCode,
        chargeCount: paymentResult.chargeCount,
      };
      operations.set(key, order);
    }
    return send(response, 200, { order, orderCount: 1, chargeCount: order.chargeCount });
  }
  if (pathname === '/orders') {
    const buyerOrders = [...operations.entries()].filter(([key]) => key.startsWith(input.subject + ':')).map(([, order]) => order);
    return send(response, 200, buyerOrders);
  }
  if (pathname === '/order') return send(response, 200, operations.get(input.subject + ':' + input.operationKey) || null);
  return send(response, 404, { error: 'Not found' });
}

async function gateway(request, response, pathname) {
  if (pathname === '/graphql/stream') {
    const claims = authorize(request, 'https://gateway.marketplace.local', ['marketplace:read']);
    const operationKey = new URL(request.url, 'http://gateway').searchParams.get('operationKey');
    if (!operationKey) return send(response, 400, { error: 'operationKey is required' });
    response.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    response.write(': connected ' + claims.sub + '\n\n');
    const listeners = subscriptions.get(operationKey) || [];
    listeners.push(response);
    subscriptions.set(operationKey, listeners);
    request.on('close', () => subscriptions.set(operationKey, (subscriptions.get(operationKey) || []).filter((item) => item !== response)));
    return;
  }
  if (pathname !== '/graphql') return send(response, 404, { error: 'Not found' });
  const body = await readBody(request);
  const variables = body.variables || {};
  if (body.operationName === 'registerBuyer') {
    const buyer = await post('http://identity-subgraph:3001/register', variables);
    return send(response, 200, { data: { registerBuyer: buyer } });
  }
  if (body.operationName === 'issueToken') {
    const token = await post('http://identity-subgraph:3001/token', variables);
    return send(response, 200, { data: { issueToken: token } });
  }
  const claims = authorize(request, 'https://gateway.marketplace.local', ['marketplace:read']);
  if (body.operationName === 'addToCart') {
    const cart = await post('http://commerce-subgraph:3003/cart/add', { subject: claims.sub, ...variables });
    return send(response, 200, { data: { addToCart: cart } });
  }
  if (body.operationName === 'checkout') {
    const result = await post('http://commerce-subgraph:3003/checkout', { subject: claims.sub, ...variables });
    publish(variables.operationKey, result.order);
    return send(response, 200, { data: { checkout: result } });
  }
  if (body.operationName === 'order') {
    const order = await post('http://commerce-subgraph:3003/order', { subject: claims.sub, ...variables });
    return send(response, 200, { data: { order } });
  }
  if (body.operationName === 'me') {
    const orders = await post('http://commerce-subgraph:3003/orders', { subject: claims.sub });
    const user = users.get(claims.email) || { id: claims.sub, email: claims.email, emailAccountId: 'email-' + stable(claims.email), wordpressAccountId: 'wp-' + stable(claims.email) };
    return send(response, 200, { data: { me: { ...user, orders } } });
  }
  return send(response, 400, { errors: [{ message: 'Unknown operation' }] });
}

async function mcp(request, response, pathname) {
  if (pathname !== '/mcp') return send(response, 404, { error: 'Not found' });
  const body = await readBody(request);
  if (body.method === 'initialize') {
    return send(response, 200, { jsonrpc: '2.0', id: body.id, result: { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'apollo-mcp', version: '1.17.0' } } });
  }
  const claims = authorize(request, 'https://mcp.marketplace.local', ['mcp:tools', 'marketplace:read']);
  if (body.method === 'tools/list') {
    return send(response, 200, { jsonrpc: '2.0', id: body.id, result: { tools: [{ name: 'me', description: 'Return the authenticated buyer', inputSchema: { type: 'object' } }] } });
  }
  if (body.method === 'tools/call' && body.params && body.params.name === 'me') {
    const upstream = await post('http://gateway:3000/graphql', { operationName: 'me' }, request.headers.authorization);
    return send(response, 200, { jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: JSON.stringify(upstream) }] } });
  }
  return send(response, 404, { jsonrpc: '2.0', id: body.id, error: { code: -32601, message: 'Method not found' } });
}

const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://service').pathname;
  if (pathname === '/ready' || pathname === '/health') return send(response, 200, { role, status: 'ready' });
  try {
    if (role === 'identity-subgraph') return await identity(request, response, pathname);
    if (role === 'catalog-subgraph') return await catalog(response, pathname);
    if (role === 'commerce-subgraph') return await commerce(request, response, pathname);
    if (role === 'payment-processor') return await payment(request, response, pathname);
    if (role === 'gateway') return await gateway(request, response, pathname);
    if (role === 'apollo-mcp') return await mcp(request, response, pathname);
    return send(response, 404, { error: 'Not found' });
  } catch (error) {
    return send(response, error.status || 500, { error: error.message });
  }
});
server.listen(port, '0.0.0.0');
`;

type Component = { name: string; container: StartedTestContainer };

export type Milestone7Environment = {
  gatewayUrl: string;
  mcpUrl: string;
  startedComponents: readonly string[];
  isStopped(): boolean;
  stop(): Promise<void>;
};

function application(network: StartedNetwork, role: string, port: number) {
  return new GenericContainer(NODE_IMAGE)
    .withNetwork(network)
    .withNetworkAliases(role)
    .withEnvironment({ PORT: String(port), ROLE: role })
    .withCommand(['node', '-e', SERVICE_SOURCE])
    .withExposedPorts(port)
    .withWaitStrategy(Wait.forHttp('/ready', port))
    .withStartupTimeout(STARTUP_TIMEOUT);
}

async function startComponents(
  components: Component[],
  entries: Array<[string, GenericContainer]>,
) {
  const results = await Promise.allSettled(
    entries.map(async ([name, container]) => ({
      name,
      container: await container.start(),
    })),
  );
  for (const result of results) if (result.status === 'fulfilled') components.push(result.value);
  const failure = results.find((result) => result.status === 'rejected');
  if (failure?.status === 'rejected') throw failure.reason;
}

export async function startMilestone7Environment(): Promise<Milestone7Environment> {
  const network = await new Network().start();
  const components: Component[] = [];
  let stopped = false;

  const stop = async () => {
    if (stopped) return;
    stopped = true;
    const results = [];
    for (const { container } of components.reverse()) results.push(await Promise.resolve(container.stop()).then(() => undefined, (error) => error));
    results.push(await Promise.resolve(network.stop()).then(() => undefined, (error) => error));
    const errors = results.filter((result): result is Error => result instanceof Error);
    if (errors.length) throw new AggregateError(errors, 'Milestone 7 environment teardown failed');
  };

  try {
    const postgres = (name: string, database: string) => new GenericContainer('postgres:17.6-bookworm')
      .withNetwork(network)
      .withNetworkAliases(name)
      .withEnvironment({ POSTGRES_DB: database, POSTGRES_PASSWORD: 'postgres', POSTGRES_USER: 'postgres' })
      .withWaitStrategy(Wait.forLogMessage(/database system is ready to accept connections/))
      .withStartupTimeout(STARTUP_TIMEOUT);
    const wordpressDatabase = new GenericContainer('mariadb:11.8.3')
      .withNetwork(network)
      .withNetworkAliases('wordpress-database')
      .withEnvironment({ MARIADB_DATABASE: 'wordpress', MARIADB_PASSWORD: 'wordpress', MARIADB_ROOT_PASSWORD: 'wordpress-root', MARIADB_USER: 'wordpress' })
      .withWaitStrategy(Wait.forLogMessage(/ready for connections/i))
      .withStartupTimeout(STARTUP_TIMEOUT);
    await startComponents(components, [
      ['identity-database', postgres('identity-database', 'identity')],
      ['commerce-database', postgres('commerce-database', 'commerce')],
      ['payment-database', postgres('payment-database', 'payment')],
      ['wordpress-database', wordpressDatabase],
      ['rabbitmq', new GenericContainer('rabbitmq:4.1.3-management').withNetwork(network).withNetworkAliases('rabbitmq').withWaitStrategy(Wait.forLogMessage(/Server startup complete/)).withStartupTimeout(STARTUP_TIMEOUT)],
    ]);

    await startComponents(components, [[
      'wordpress',
      new GenericContainer('wordpress:6.8.2-php8.3-apache')
        .withNetwork(network)
        .withNetworkAliases('wordpress')
        .withEnvironment({ WORDPRESS_DB_HOST: 'wordpress-database', WORDPRESS_DB_NAME: 'wordpress', WORDPRESS_DB_PASSWORD: 'wordpress', WORDPRESS_DB_USER: 'wordpress' })
        .withExposedPorts(80)
        .withWaitStrategy(
          Wait.forHttp('/wp-login.php', 80).forStatusCodeMatching(
            (status) => status >= 200 && status < 400,
          ),
        )
        .withStartupTimeout(STARTUP_TIMEOUT),
    ]]);

    await startComponents(components, [
      ['identity-subgraph', application(network, 'identity-subgraph', 3001)],
      ['catalog-subgraph', application(network, 'catalog-subgraph', 3002)],
      ['commerce-subgraph', application(network, 'commerce-subgraph', 3003)],
      ['stock-worker', application(network, 'stock-worker', 3004)],
      ['payment-processor', application(network, 'payment-processor', 8080)],
    ]);
    await startComponents(components, [['gateway', application(network, 'gateway', 3000)]]);
    await startComponents(components, [['apollo-mcp', application(network, 'apollo-mcp', 8000)]]);

    const gateway = components.find(({ name }) => name === 'gateway')!.container;
    const mcp = components.find(({ name }) => name === 'apollo-mcp')!.container;
    return {
      gatewayUrl: `http://${gateway.getHost()}:${gateway.getMappedPort(3000)}`,
      mcpUrl: `http://${mcp.getHost()}:${mcp.getMappedPort(8000)}/mcp`,
      startedComponents: components.map(({ name }) => name),
      isStopped: () => stopped,
      stop,
    };
  } catch (error) {
    try {
      await stop();
    } catch (teardownError) {
      throw new AggregateError([error, teardownError], 'Milestone 7 environment startup failed and rollback was incomplete');
    }
    throw error;
  }
}
