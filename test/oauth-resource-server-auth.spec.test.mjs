// Testes de spec da feature oauth-resource-server-auth — gerados por onp-spec scaffold
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// US-087 — Preserve OAuth proof across federation boundaries
test('AC-174: Tokens are issued for every owned protected resource @spec:AC-174', async () => {
  // Dado: Better Auth configured as the platform authorization server
  // Quando: a Gateway, MCP, Order Workflow, Identity, or Payment token is issued
  // Então: each owned protected resource has an explicit audience and allowed scopes, while WordPress session integration remains outside this OAuth trust model
  const [resources, factory, journey] = await Promise.all([
    readFile('libs/identity/nest/src/oauth-issuer/oauth-resources.ts', 'utf8'),
    readFile(
      'libs/identity/nest/src/better-auth/better-auth.factory.ts',
      'utf8',
    ),
    readFile('apps/e2e/src/journey.ts', 'utf8'),
  ]);
  for (const resource of [
    'gateway',
    'identity',
    'mcp',
    'orderWorkflow',
    'payment',
  ]) {
    assert.match(resources, new RegExp(`${resource}:`));
  }
  assert.match(factory, /Object\.values\(OAUTH_RESOURCES\)/);
  assert.match(factory, /OAUTH_RESOURCE_SCOPES\[identifier\]/);
  assert.match(factory, /skip_consent: true/);
  assert.equal(
    [
      ...resources.matchAll(
        /\[OAUTH_RESOURCES\.[^\]]+\]: DELEGATED_OAUTH_SCOPES/g,
      ),
    ].length,
    5,
  );
  for (const scope of [
    'mcp:tools',
    'marketplace:read',
    'cart:read',
    'orders:read',
    'cart:write',
  ]) {
    assert.match(resources, new RegExp(`['"]${scope}['"]`));
  }
  for (const audience of [
    'GATEWAY',
    'IDENTITY',
    'MCP',
    'ORDER_WORKFLOW',
    'PAYMENT',
  ]) {
    assert.match(journey, new RegExp(`${audience}_AUDIENCE,`));
  }
  assert.match(journey, /underScoped/);
  assert.doesNotMatch(resources, /wordpress/i);
});

// US-087 — Preserve OAuth proof across federation boundaries
test('AC-175: Federation preserves the standard bearer credential @spec:AC-175', async () => {
  // Dado: a valid authenticated GraphQL request entering the Gateway
  // Quando: the Gateway calls an owned subgraph
  // Então: it forwards the bearer credential and request correlation data without manufacturing `x-authenticated-subject`, `x-authenticated-scopes`, or a shared federation secret
  const [source, stream] = await Promise.all([
    readFile(
      'libs/gateway/nest/src/federation/authenticated-data-source.ts',
      'utf8',
    ),
    readFile(
      'apps/gateway/src/subscriptions/order-workflow-subscription.client.ts',
      'utf8',
    ),
  ]);
  assert.match(source, /set\('authorization', context\.authorization\)/);
  assert.match(stream, /authorization: context\.authorization/);
  assert.match(`${source}\n${stream}`, /x-request-id/);
  assert.doesNotMatch(
    `${source}\n${stream}`,
    /x-federation-secret|x-authenticated-subject|x-authenticated-scopes/,
  );
});

// US-088 — Reuse native resource-server integration in NestJS
test('AC-176: NestJS resource servers use Better Auth verification @spec:AC-176', async () => {
  // Dado: the shared NestJS authentication module
  // Quando: Identity or Order Workflow receives GraphQL or HTTP traffic
  // Então: an injectable guard uses Better Auth `verifyAccessTokenRequest`, exposes typed verified claims in the execution context, and metadata-driven scope guards remain reusable by resolvers
  const [
    service,
    guard,
    guardSpec,
    scopesDecorator,
    orderModule,
    identityModule,
    orderOperations,
  ] = await Promise.all([
    readFile(
      'libs/platform/nest/src/oauth-resource/verification/oauth-resource.service.ts',
      'utf8',
    ),
    readFile(
      'libs/platform/nest/src/oauth-resource/graphql/oauth-resource.guard.ts',
      'utf8',
    ),
    readFile(
      'libs/platform/nest/src/oauth-resource/graphql/oauth-resource.guard.spec.ts',
      'utf8',
    ),
    readFile(
      'libs/platform/nest/src/oauth-resource/graphql/require-scopes.decorator.ts',
      'utf8',
    ),
    readFile(
      'apps/order-workflow-subgraph/src/graphql/order-workflow-graphql.module.ts',
      'utf8',
    ),
    readFile('libs/identity/nest/src/identity.module.ts', 'utf8'),
    readFile(
      'apps/order-workflow-subgraph/src/graphql/order-workflow-operations.service.ts',
      'utf8',
    ),
  ]);
  assert.match(service, /verifyAccessTokenRequest/);
  assert.match(service, /requestToResourceInput/);
  assert.match(guard, /Reflector/);
  assert.match(scopesDecorator, /RequireScopes/);
  assert.match(orderModule, /OAuthResourceModule\.register/);
  assert.match(identityModule, /OAuthResourceModule\.register/);
  assert.match(
    orderOperations,
    /findWorkflow\([\s\S]*subject: string,[\s\S]*wooOrderId: string/,
  );
  assert.match(
    orderOperations,
    /CheckoutOperation, \{[\s\S]*subject,[\s\S]*wooOrderId/,
  );
  assert.match(guardSpec, /verify\)\.toHaveBeenCalledOnce\(\)/);
  assert.match(guardSpec, /context\)\.toMatchObject\(\{ auth \}\)/);
});

// US-089 — Use Spring Security at the Java boundary
test('AC-177: Payment is a standard Spring OAuth resource server @spec:AC-177', async () => {
  // Dado: the Payment GraphQL federation endpoint
  // Quando: a bearer token reaches the Java runtime
  // Então: Spring Security validates signature, issuer, audience, expiry, and required scopes before GraphQL business code, with no static federation-secret interceptor
  const [build, security, controller, graphql, application] = await Promise.all(
    [
      readFile('apps/payment-federation/build.gradle.kts', 'utf8'),
      readFile(
        'apps/payment-federation/src/main/java/dev/desafio/transaction/payment/configuration/PaymentSecurityConfiguration.java',
        'utf8',
      ),
      readFile(
        'apps/payment-federation/src/main/java/dev/desafio/transaction/payment/adapter/graphql/PaymentController.java',
        'utf8',
      ),
      readFile(
        'apps/payment-federation/src/main/java/dev/desafio/transaction/payment/configuration/PaymentGraphqlConfiguration.java',
        'utf8',
      ),
      readFile(
        'apps/payment-federation/src/main/resources/application.yaml',
        'utf8',
      ),
    ],
  );

  assert.match(build, /spring-boot-starter-oauth2-resource-server/);
  assert.match(security, /@EnableMethodSecurity/);
  assert.match(security, /requestMatchers\("\/graphql"\)\.authenticated\(\)/);
  assert.match(security, /oauth2ResourceServer\(oauth2 -> oauth2\.jwt\(/);
  assert.match(
    controller,
    /@PreAuthorize\("[^"]*hasAuthority\('SCOPE_orders:read'\)"\)/,
  );
  assert.match(
    controller,
    /@PreAuthorize\("[^"]*hasAuthority\('SCOPE_cart:write'\)"\)/,
  );
  assert.match(application, /issuer-uri: \$\{OAUTH_ISSUER:/);
  assert.match(application, /jwk-set-uri: \$\{IDENTITY_JWKS_URL:/);
  assert.match(
    application,
    /audiences:\n\s+- \$\{PAYMENT_OAUTH_AUDIENCE:https:\/\/payment\.marketplace\.local\}/,
  );
  assert.doesNotMatch(
    `${graphql}\n${controller}`,
    /x-federation-secret|x-authenticated-subject|x-authenticated-scopes|WebGraphQlInterceptor/,
  );
});

// US-090 — Keep streaming authentication equivalent to GraphQL
test('AC-178: SSE validates the same bearer token @spec:AC-178', async () => {
  // Dado: the Gateway and Order Workflow SSE path
  // Quando: a subscription connection is opened
  // Então: the standard bearer credential is verified through the shared resource-server service and the verified subject owns the stream
  const [gateway, downstream, orderWorkflow] = await Promise.all([
    readFile('apps/gateway/src/subscriptions/sse-handler.ts', 'utf8'),
    readFile(
      'apps/gateway/src/subscriptions/order-workflow-subscription.client.ts',
      'utf8',
    ),
    readFile(
      'apps/order-workflow-subgraph/src/graphql/sse/sse-handler.ts',
      'utf8',
    ),
  ]);
  assert.match(gateway, /authenticated\.set\(raw, await verify\(raw\)\)/);
  assert.match(gateway, /GatewayContext/);
  assert.match(downstream, /authorization: context\.authorization/);
  assert.match(orderWorkflow, /await verify\(toOAuthRequest\(raw\)\)/);
  assert.match(orderWorkflow, /auth,/);
});

// US-091 — Turn native-first integration into a maintained rule
test('AC-179: Native-first boundaries are documented and executable @spec:AC-179', async () => {
  // Dado: the Better Auth migration as a reference implementation
  // Quando: architecture documentation and quality tests are inspected
  // Então: they require native security/configuration/lifecycle facilities first, record any remaining custom gap, and prevent the removed identity-header protocol from returning
  const [adr, gateway, orderModule] = await Promise.all([
    readFile('docs/adrs/0012-native-first-security-boundaries.md', 'utf8'),
    readFile(
      'libs/gateway/nest/src/federation/authenticated-data-source.ts',
      'utf8',
    ),
    readFile(
      'apps/order-workflow-subgraph/src/graphql/order-workflow-graphql.module.ts',
      'utf8',
    ),
  ]);
  assert.match(adr, /native-first/i);
  assert.match(adr, /Better Auth/);
  assert.match(adr, /Spring Security/);
  assert.doesNotMatch(
    `${gateway}\n${orderModule}`,
    /x-federation-secret|x-authenticated-subject|x-authenticated-scopes/,
  );
});

test('AC-180: DPoP verification receives a non-spoofable request target @spec:AC-180', async () => {
  const { toOAuthRequest } = await import(
    '../libs/platform/nest/src/oauth-resource/verification/oauth-request.adapter.ts'
  );
  const request = toOAuthRequest({
    headers: {
      host: 'internal:3000',
      'x-forwarded-host': 'api.example.com',
      'x-forwarded-proto': 'https',
    },
    method: 'POST',
    originalUrl: '/graphql?operation=checkout',
  });

  assert.equal(request.method, 'POST');
  assert.equal(request.url, 'http://internal:3000/graphql?operation=checkout');
});

test('AC-181: Authentication and scope authorization have distinct outcomes @spec:AC-181', async () => {
  const [guard, guardSpec] = await Promise.all([
    readFile(
      'libs/platform/nest/src/oauth-resource/graphql/oauth-resource.guard.ts',
      'utf8',
    ),
    readFile(
      'libs/platform/nest/src/oauth-resource/graphql/oauth-resource.guard.spec.ts',
      'utf8',
    ),
  ]);
  assert.match(guard, /UnauthorizedException/);
  assert.match(guard, /ForbiddenException/);
  assert.match(guardSpec, /rejects\.toThrow\([\s\S]*ForbiddenException/);
  assert.match(guardSpec, /typed Better Auth credential rejection/);
  assert.match(guardSpec, /preserves JWKS and unexpected operational failures/);
});

test('AC-182: Gateway and subgraphs share one token verification policy @spec:AC-182', async () => {
  const [gatewayVerifier, gatewayAuthModule] = await Promise.all([
    readFile('libs/gateway/nest/src/auth/token-verifier.service.ts', 'utf8'),
    readFile('libs/gateway/nest/src/auth/gateway-auth.module.ts', 'utf8'),
  ]);
  assert.doesNotMatch(
    gatewayVerifier,
    /verifyAccessTokenRequest|requestToResourceInput/,
  );
  assert.match(gatewayVerifier, /OAuthResourceService/);
  assert.match(gatewayAuthModule, /OAuthResourceModule\.register/);
});

test('AC-183: Authentication composition contains no redundant wrappers or context state @spec:AC-183', async () => {
  const [guard, resolver, factory, module] = await Promise.all([
    readFile(
      'libs/platform/nest/src/oauth-resource/graphql/oauth-resource.guard.ts',
      'utf8',
    ),
    readFile(
      'apps/order-workflow-subgraph/src/graphql/order-workflow.resolver.ts',
      'utf8',
    ),
    readFile(
      'libs/identity/nest/src/better-auth/better-auth.factory.ts',
      'utf8',
    ),
    readFile(
      'libs/identity/nest/src/better-auth/better-auth.module.ts',
      'utf8',
    ),
  ]);
  assert.doesNotMatch(guard, /context\.subject\s*=/);
  assert.match(resolver, /OAuthSubject/);
  assert.doesNotMatch(resolver, /AuthenticatedSubject/);
  assert.doesNotMatch(
    `${factory}\n${module}`,
    /JwtPluginFactory|OAuthProviderPluginFactory/,
  );
});

test('AC-184: Authentication changes remain compatible with canonical CI runtimes @spec:AC-184', async () => {
  const [
    nestModule,
    architectureTest,
    paymentHandlerTest,
    compose,
    paymentDockerfile,
    ...nodeDockerfiles
  ] = await Promise.all([
    readFile(
      'libs/platform/nest/src/oauth-resource/oauth-resource.module.ts',
      'utf8',
    ),
    readFile(
      'apps/payment-federation/src/test/java/dev/desafio/transaction/payment/application/ArchitectureBoundariesTest.java',
      'utf8',
    ),
    readFile(
      'apps/payment-federation/src/test/java/dev/desafio/payment/application/PaymentHandlerTest.java',
      'utf8',
    ),
    readFile('compose.yaml', 'utf8'),
    readFile('apps/payment-federation/Dockerfile', 'utf8'),
    readFile('apps/gateway/Dockerfile', 'utf8'),
    readFile('apps/identity-subgraph/Dockerfile', 'utf8'),
    readFile('apps/order-workflow-subgraph/Dockerfile', 'utf8'),
  ]);

  assert.match(nestModule, /@Module\s*\(\{\}\)/);
  assert.doesNotMatch(nestModule, /Module\(\{\}\)\(OAuthResourceModule\)/);
  assert.match(architectureTest, /class ArchitectureBoundariesTest/);
  assert.match(paymentHandlerTest, /class PaymentHandlerTest/);
  for (const containerDefinition of [compose, ...nodeDockerfiles]) {
    assert.match(
      containerDefinition,
      /COPY .*libs\/platform\/nest .*libs\/platform\/nest/,
    );
  }
  assert.match(compose, /SPRING_PROFILES_ACTIVE: local/);
  assert.match(nodeDockerfiles[2], /COPY .*package\.json .*package\.json/);
  assert.match(paymentDockerfile, /RUN gradle clean --no-daemon bootJar/);
});
