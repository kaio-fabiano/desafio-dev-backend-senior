import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const libraryRoot = 'libs/gateway/nest/src';

test('AC-095: Gateway contains only authenticated federation edge responsibilities @spec:AC-095', async () => {
  const [
    main,
    appModule,
    gatewayModule,
    project,
    { AuthContextFactory },
    { TokenVerifierService },
  ] = await Promise.all([
    readFile('apps/gateway/src/main.ts', 'utf8'),
    readFile('apps/gateway/src/app.module.ts', 'utf8'),
    readFile(`${libraryRoot}/gateway.module.ts`, 'utf8'),
    readFile('libs/gateway/nest/project.json', 'utf8'),
    import(`../${libraryRoot}/auth/auth-context.factory.ts`),
    import(`../${libraryRoot}/auth/token-verifier.service.ts`),
  ]);

  assert.match(
    main,
    /NestFactory\.create\(AppModule(?:, \{ bodyParser: false \})?\)/,
  );
  assert.match(main, /enableShutdownHooks\(\)/);
  assert.doesNotMatch(main, /ProductLoader|OrderLoader|BusinessRepository/);
  assert.match(
    appModule,
    /from ['"]@desafio-dev-backend-senior\/source\/gateway-nest['"]/,
  );
  assert.doesNotMatch(
    appModule,
    /from ['"]@nestjs\/apollo['"]|from ['"]@apollo\/gateway['"]|readFileSync\(/,
  );
  assert.match(gatewayModule, /ApolloGatewayDriver/);
  assert.match(gatewayModule, /LocalCompose/);
  assert.match(gatewayModule, /AuthenticatedDataSource/);
  assert.match(gatewayModule, /AuthContextFactory/);
  assert.match(gatewayModule, /wordpress-federation:3004\/graphql/);
  assert.match(gatewayModule, /payment-processor:8080\/graphql/);
  assert.match(gatewayModule, /commerce-subgraph:3003\/graphql/);
  assert.doesNotMatch(gatewayModule, /stock-worker/);
  assert.doesNotMatch(
    `${main}\n${appModule}\n${gatewayModule}`,
    /ProductLoader|OrderLoader|BusinessRepository/,
  );

  const parsedProject = JSON.parse(project);
  assert.equal(parsedProject.projectType, 'library');
  assert.deepEqual(parsedProject.tags, ['type:lib', 'scope:gateway']);
  assert.deepEqual(Object.keys(parsedProject.targets).sort(), [
    'build',
    'lint',
    'test',
    'typecheck',
  ]);

  const now = 2_000_000_000;
  const tokens = new TokenVerifierService({
    issuer: 'https://identity.test/api/auth',
    audience: 'https://gateway.marketplace.local',
    requiredScopes: ['marketplace:read'],
    now: () => now * 1000,
    verify: async () => ({
      sub: 'buyer-1',
      iss: 'https://identity.test/api/auth',
      aud: 'https://gateway.marketplace.local',
      exp: now + 60,
      scope: 'marketplace:read',
    }),
  });
  const context = await new AuthContextFactory(tokens).create({
    headers: {
      host: 'gateway.test',
      'woocommerce-session': 'session-token',
      'cart-token': 'cart-token',
    },
    method: 'POST',
    rawHeaders: [
      'authorization',
      'Bearer signed-token',
      'woocommerce-session',
      'session-token',
      'cart-token',
      'cart-token',
    ],
    url: '/graphql',
  });
  assert.equal(context.subject, 'buyer-1');
  assert.deepEqual(context.scopes, ['marketplace:read']);
  assert.deepEqual(context.sessionHeaders, {
    'woocommerce-session': 'session-token',
    'cart-token': 'cart-token',
  });
  await assert.rejects(
    () =>
      new AuthContextFactory({
        async verify() {
          throw new Error('sensitive verifier detail');
        },
      }).create({
        headers: { host: 'gateway.test' },
        method: 'POST',
        rawHeaders: [],
        url: '/graphql',
      }),
    (error) =>
      error.message === 'Unauthorized' &&
      error.extensions.code === 'UNAUTHENTICATED' &&
      error.extensions.http.status === 401,
  );
});

test('AC-096: Gateway propagates verified identity and leaves sensitive authorization to subgraphs @spec:AC-096', async () => {
  const [{ AuthenticatedDataSource }, gatewayModule] = await Promise.all([
    import(`../${libraryRoot}/federation/authenticated-data-source.ts`),
    readFile(`${libraryRoot}/gateway.module.ts`, 'utf8'),
  ]);
  const source = new AuthenticatedDataSource({
    url: 'http://identity-federation/graphql',
  });
  const headers = new Headers();

  source.willSendRequest({
    request: { http: { headers } },
    context: {
      subject: 'supplier-user',
      scopes: ['marketplace:read', 'payment:authorize'],
      audience: ['https://gateway.marketplace.local'],
      supplierCompanyId: 'supplier-company',
      requestId: 'request-1',
      sessionHeaders: {
        'woocommerce-session': 'session-token',
        'cart-token': 'cart-token',
      },
    },
  });

  assert.equal(headers.get('x-authenticated-subject'), 'supplier-user');
  assert.equal(
    headers.get('x-authenticated-scopes'),
    'marketplace:read payment:authorize',
  );
  assert.equal(headers.get('x-supplier-company-id'), 'supplier-company');
  assert.equal(headers.get('x-request-id'), 'request-1');
  assert.equal(headers.get('woocommerce-session'), 'session-token');
  assert.equal(headers.get('cart-token'), 'cart-token');

  const returnedHeaders = [];
  source.didReceiveResponse({
    response: {
      http: {
        headers: new Headers({
          'woocommerce-session': 'next-session-token',
          'cart-token': 'next-cart-token',
          'set-cookie': 'wp_woocommerce_session=value; Path=/; HttpOnly',
        }),
      },
    },
    context: {
      subject: 'supplier-user',
      scopes: ['marketplace:read'],
      audience: ['https://gateway.marketplace.local'],
      requestId: 'request-1',
      setResponseHeader: (name, value) => returnedHeaders.push([name, value]),
    },
  });
  assert.deepEqual(returnedHeaders, [
    ['woocommerce-session', 'next-session-token'],
    ['cart-token', 'next-cart-token'],
    ['set-cookie', 'wp_woocommerce_session=value; Path=/; HttpOnly'],
  ]);
  assert.doesNotMatch(gatewayModule, /ForbiddenException|assertOwnership/);

  const unauthenticatedHeaders = new Headers();
  source.willSendRequest({
    request: { http: { headers: unauthenticatedHeaders } },
    context: undefined,
  });
  assert.deepEqual([...unauthenticatedHeaders], []);
});
