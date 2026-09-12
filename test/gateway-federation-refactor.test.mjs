import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

import { Test } from '@nestjs/testing';

import { AppModule } from '../apps/gateway/src/app.module.ts';
import { GatewaySseHandler } from '../apps/gateway/src/subscriptions/sse-handler.ts';
import { OrderWorkflowSubscriptionClient } from '../apps/gateway/src/subscriptions/order-workflow-subscription.client.ts';
import { CommerceCookiePort } from '../libs/gateway/nest/src/application/ports/commerce-cookie.port.ts';
import { GatewayTokenVerifierPort } from '../libs/gateway/nest/src/application/ports/gateway-token-verifier.port.ts';
import { OrderWorkflowSubscriptionPort } from '../libs/gateway/nest/src/application/ports/order-workflow-subscription.port.ts';
import { WordPressCredentialPort } from '../libs/gateway/nest/src/application/ports/wordpress-credential.port.ts';
import { CaptureFederationResponseUseCase } from '../libs/gateway/nest/src/application/use-cases/capture-federation-response.use-case.ts';
import { CreateGatewayContextUseCase } from '../libs/gateway/nest/src/application/use-cases/create-gateway-context.use-case.ts';
import { ForwardGatewaySubscriptionUseCase } from '../libs/gateway/nest/src/application/use-cases/forward-gateway-subscription.use-case.ts';
import { PrepareFederationRequestUseCase } from '../libs/gateway/nest/src/application/use-cases/prepare-federation-request.use-case.ts';
import { AuthContextFactory } from '../libs/gateway/nest/src/auth/auth-context.factory.ts';
import { TokenVerifierService } from '../libs/gateway/nest/src/auth/token-verifier.service.ts';
import { AuthenticatedDataSource } from '../libs/gateway/nest/src/federation/authenticated-data-source.ts';
import { GatewayFederationConfiguration } from '../libs/gateway/nest/src/federation/gateway-federation.configuration.ts';
import { CommerceCookieAdapter } from '../libs/gateway/nest/src/infrastructure/http/commerce-cookie.adapter.ts';
import { WpGraphqlCredentialAdapter } from '../libs/gateway/nest/src/infrastructure/http/wp-graphql-credential.adapter.ts';

const libraryRoot = 'libs/gateway/nest/src';
const config = {
  get(name) {
    return name === 'GATEWAY_ORIGIN'
      ? 'https://gateway.marketplace.local'
      : undefined;
  },
};

const gatewayCoreFiles = [
  'application/ports/commerce-cookie.port.ts',
  'application/ports/gateway-token-verifier.port.ts',
  'application/ports/order-workflow-subscription.port.ts',
  'application/ports/wordpress-credential.port.ts',
  'application/use-cases/capture-federation-response.use-case.ts',
  'application/use-cases/create-gateway-context.use-case.ts',
  'application/use-cases/forward-gateway-subscription.use-case.ts',
  'application/use-cases/prepare-federation-request.use-case.ts',
];

function dataSource(config) {
  return new AuthenticatedDataSource(
    config,
    new PrepareFederationRequestUseCase(new CommerceCookieAdapter(), {
      exchange: async (subject) => `wordpress-${subject}`,
    }),
    new CaptureFederationResponseUseCase(),
  );
}

function authFactory(tokens) {
  return new AuthContextFactory(
    new CreateGatewayContextUseCase(tokens, new CommerceCookieAdapter()),
    config,
  );
}

test('AC-274: Gateway flows are resolved as NestJS-managed providers @spec:AC-274', async () => {
  const testingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  try {
    assert.equal(
      testingModule.get(GatewayTokenVerifierPort),
      testingModule.get(TokenVerifierService),
    );
    assert.equal(
      testingModule.get(CommerceCookiePort),
      testingModule.get(CommerceCookieAdapter),
    );
    assert.equal(
      testingModule.get(WordPressCredentialPort),
      testingModule.get(WpGraphqlCredentialAdapter),
    );
    assert.equal(
      testingModule.get(OrderWorkflowSubscriptionPort),
      testingModule.get(OrderWorkflowSubscriptionClient),
    );
    for (const provider of [
      CreateGatewayContextUseCase,
      PrepareFederationRequestUseCase,
      CaptureFederationResponseUseCase,
      ForwardGatewaySubscriptionUseCase,
      GatewayFederationConfiguration,
      GatewaySseHandler,
    ]) {
      assert.ok(testingModule.get(provider));
    }
  } finally {
    await testingModule.close();
  }
});

test('AC-256: Gateway application dependencies point inward through abstract ports @spec:AC-256', async () => {
  const missing = [];
  for (const file of gatewayCoreFiles) {
    try {
      await access(`${libraryRoot}/${file}`);
    } catch {
      missing.push(file);
    }
  }
  assert.deepEqual(missing, []);

  const sources = await Promise.all(
    gatewayCoreFiles.map((file) =>
      readFile(`${libraryRoot}/${file}`, 'utf8').then((source) => [
        file,
        source,
      ]),
    ),
  );
  for (const [file, source] of sources) {
    assert.doesNotMatch(
      source,
      /from ['"](?:@apollo|graphql|graphql-sse|express)/,
      file,
    );
    if (file.endsWith('.port.ts')) {
      assert.match(source, /export abstract class /, file);
      assert.doesNotMatch(source, /from ['"]@nestjs/, file);
    }
  }
});

test('AC-265: Gateway is a thin edge with explicit application ports @spec:AC-265', async () => {
  const [main, appModule, middleware, authFactory, dataSource, handler] =
    await Promise.all([
      readFile('apps/gateway/src/main.ts', 'utf8'),
      readFile('apps/gateway/src/app.module.ts', 'utf8'),
      readFile('apps/gateway/src/subscriptions/sse.middleware.ts', 'utf8'),
      readFile(`${libraryRoot}/auth/auth-context.factory.ts`, 'utf8'),
      readFile(
        `${libraryRoot}/federation/authenticated-data-source.ts`,
        'utf8',
      ),
      readFile('apps/gateway/src/subscriptions/sse-handler.ts', 'utf8'),
    ]);

  assert.doesNotMatch(main, /OrderWorkflowSubscriptionClient|createClient\(/);
  assert.match(appModule, /useExisting: OrderWorkflowSubscriptionClient/);
  await assert.rejects(access(`${libraryRoot}/domain`));
  assert.doesNotMatch(
    middleware,
    /new (?:GatewaySseHandler|OrderWorkflowSubscriptionClient)/,
  );
  assert.match(authFactory, /CreateGatewayContextUseCase/);
  assert.match(dataSource, /PrepareFederationRequestUseCase/);
  assert.match(dataSource, /CaptureFederationResponseUseCase/);
  assert.match(handler, /ForwardGatewaySubscriptionUseCase/);
});

test('AC-268: characterized Gateway behavior moves behind application orchestration @spec:AC-268 @principle:P-003', async () => {
  const [authFactory, dataSource, handler] = await Promise.all([
    readFile(`${libraryRoot}/auth/auth-context.factory.ts`, 'utf8'),
    readFile(`${libraryRoot}/federation/authenticated-data-source.ts`, 'utf8'),
    readFile('apps/gateway/src/subscriptions/sse-handler.ts', 'utf8'),
  ]);

  assert.match(authFactory, /\.execute\(/);
  assert.match(dataSource, /\.execute\(/);
  assert.match(handler, /\.execute\(/);
});

test('AC-095: Gateway contains only authenticated federation edge responsibilities @spec:AC-095', async () => {
  const [main, appModule, gatewayModule, federationConfiguration, project] =
    await Promise.all([
      readFile('apps/gateway/src/main.ts', 'utf8'),
      readFile('apps/gateway/src/app.module.ts', 'utf8'),
      readFile(`${libraryRoot}/gateway.module.ts`, 'utf8'),
      readFile(
        `${libraryRoot}/federation/gateway-federation.configuration.ts`,
        'utf8',
      ),
      readFile('libs/gateway/nest/project.json', 'utf8'),
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
  assert.match(federationConfiguration, /LocalCompose/);
  assert.match(federationConfiguration, /AuthenticatedDataSource/);
  assert.match(federationConfiguration, /AuthContextFactory/);
  assert.match(federationConfiguration, /http:\/\/wordpress\/graphql/);
  assert.match(federationConfiguration, /payment-federation:8080\/graphql/);
  assert.match(
    federationConfiguration,
    /payment-federation:8080\/graphql/,
  );
  assert.doesNotMatch(federationConfiguration, /stock-worker/);
  assert.doesNotMatch(
    `${main}\n${appModule}\n${gatewayModule}\n${federationConfiguration}`,
    /ProductLoader|OrderLoader|BusinessRepository/,
  );

  const parsedProject = JSON.parse(project);
  assert.equal(parsedProject.projectType, 'library');
  assert.deepEqual(parsedProject.tags, ['type:lib', 'scope:gateway']);
  assert.deepEqual(Object.keys(parsedProject.targets).sort(), [
    'build',
    'lint',
    'test',
    'test-typecheck',
    'typecheck',
  ]);

  const tokens = new TokenVerifierService({
    verify: async () => ({
      subject: 'buyer-1',
      audience: ['https://gateway.marketplace.local'],
      scopes: ['marketplace:read'],
      claims: {},
    }),
  });
  const context = await authFactory(tokens).create({
    headers: {
      host: 'gateway.test',
      'woocommerce-session': 'session-token',
      'cart-token': 'cart-token',
    },
    method: 'POST',
    rawHeaders: [
      'authorization',
      'Bearer eyJhbGciOiJFUzI1NiIsImtpZCI6InRlc3QifQ.e30.signature',
      'woocommerce-session',
      'session-token',
      'cart-token',
      'cart-token',
    ],
    url: '/graphql',
  });
  assert.equal(context.principal.subject, 'buyer-1');
  assert.deepEqual(context.principal.scopes, ['marketplace:read']);
  assert.deepEqual(context.sessionHeaders, {
    'woocommerce-session': 'session-token',
    'cart-token': 'cart-token',
  });
  await assert.rejects(
    () =>
      authFactory({
        async verifyToken() {
          const { APIError } = await import('better-auth');
          throw new APIError('UNAUTHORIZED');
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
  const gatewayModule = await readFile(
    `${libraryRoot}/gateway.module.ts`,
    'utf8',
  );
  const source = dataSource({
    capabilities: { bearer: true },
    url: 'http://identity-federation/graphql',
  });
  const headers = new Headers();

  await source.willSendRequest({
    request: { http: { headers } },
    context: {
      authorization: 'Bearer access-token',
      principal: {
        subject: 'supplier-user',
        scopes: ['marketplace:read', 'payment:authorize'],
        audience: ['https://gateway.marketplace.local'],
        supplierCompanyId: 'supplier-company',
      },
      requestId: 'request-1',
      sessionHeaders: {
        'woocommerce-session': 'session-token',
        'cart-token': 'cart-token',
        authorization: 'Bearer must-not-forward',
      },
    },
  });

  assert.equal(headers.get('authorization'), 'Bearer access-token');
  assert.equal(headers.get('x-authenticated-subject'), null);
  assert.equal(headers.get('x-authenticated-scopes'), null);
  assert.equal(headers.get('x-supplier-company-id'), null);
  assert.equal(headers.get('x-request-id'), 'request-1');
  assert.equal(headers.get('woocommerce-session'), null);
  assert.equal(headers.get('cart-token'), null);

  const orderWorkflow = dataSource({
    capabilities: { bearer: true, requestSession: true },
    url: 'http://payment-federation:8080/graphql',
  });
  const orderWorkflowHeaders = new Headers();
  await orderWorkflow.willSendRequest({
    request: { http: { headers: orderWorkflowHeaders } },
    context: {
      authorization: 'Bearer workflow-token',
      principal: {
        subject: 'buyer-1',
        scopes: ['marketplace:read'],
        audience: ['https://gateway.marketplace.local'],
      },
      requestId: 'request-2',
      sessionHeaders: {
        'woocommerce-session': 'session-token',
        'cart-token': 'cart-token',
      },
    },
  });
  assert.equal(
    orderWorkflowHeaders.get('woocommerce-session'),
    'session-token',
  );
  assert.equal(orderWorkflowHeaders.get('cart-token'), 'cart-token');
  assert.equal(
    orderWorkflowHeaders.get('authorization'),
    'Bearer workflow-token',
  );

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
      authorization: 'Bearer access-token',
      principal: {
        subject: 'supplier-user',
        scopes: ['marketplace:read'],
        audience: ['https://gateway.marketplace.local'],
      },
      requestId: 'request-1',
      sessionHeaders: {},
      setResponseHeader: (name, value) => returnedHeaders.push([name, value]),
    },
  });
  assert.deepEqual(returnedHeaders, []);

  const wordpress = dataSource({
    capabilities: {
      origin: 'http://wordpress',
      wordpressCredential: true,
    },
    url: 'http://wordpress/graphql',
  });
  const wordpressHeaders = new Headers();
  await wordpress.willSendRequest({
    request: { http: { headers: wordpressHeaders } },
    context: {
      authorization: '',
      principal: {
        subject: 'supplier-user',
        scopes: ['marketplace:read'],
        audience: ['https://gateway.marketplace.local'],
      },
      requestId: 'request-1',
      sessionHeaders: {
        'woocommerce-session': 'session-token',
        'cart-token': 'cart-token',
      },
    },
  });
  assert.equal(wordpressHeaders.get('origin'), 'http://wordpress');
  assert.equal(
    wordpressHeaders.get('authorization'),
    'Bearer wordpress-supplier-user',
  );
  assert.equal(wordpressHeaders.get('woocommerce-session'), null);
  assert.equal(wordpressHeaders.get('cart-token'), null);
  wordpress.didReceiveResponse({
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
      authorization: '',
      principal: {
        subject: 'supplier-user',
        scopes: ['marketplace:read'],
        audience: ['https://gateway.marketplace.local'],
      },
      requestId: 'request-1',
      sessionHeaders: {},
      setResponseHeader: (name, value) => returnedHeaders.push([name, value]),
    },
  });
  assert.deepEqual(returnedHeaders, []);
  assert.doesNotMatch(gatewayModule, /ForbiddenException|assertOwnership/);

  const unauthenticatedHeaders = new Headers();
  await source.willSendRequest({
    request: { http: { headers: unauthenticatedHeaders } },
    context: undefined,
  });
  assert.deepEqual([...unauthenticatedHeaders], []);
});
