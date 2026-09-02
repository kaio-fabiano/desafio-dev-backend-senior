// Testes de spec da feature oauth-resource-server-auth — gerados por onp-spec scaffold
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// US-087 — Preserve OAuth proof across federation boundaries
test('AC-174: Tokens are issued for every owned protected resource @spec:AC-174', () => {
  // Dado: Better Auth configured as the platform authorization server
  // Quando: a Gateway, MCP, Order Workflow, Identity, or Payment token is issued
  // Então: each owned protected resource has an explicit audience and allowed scopes, while WordPress session integration remains outside this OAuth trust model
  assert.fail('critério de aceite AC-174 ainda não provado — implemente este teste');
});

// US-087 — Preserve OAuth proof across federation boundaries
test('AC-175: Federation preserves the standard bearer credential @spec:AC-175', () => {
  // Dado: a valid authenticated GraphQL request entering the Gateway
  // Quando: the Gateway calls an owned subgraph
  // Então: it forwards the bearer credential and request correlation data without manufacturing `x-authenticated-subject`, `x-authenticated-scopes`, or a shared federation secret
  assert.fail('critério de aceite AC-175 ainda não provado — implemente este teste');
});

// US-088 — Reuse native resource-server integration in NestJS
test('AC-176: NestJS resource servers use Better Auth verification @spec:AC-176', () => {
  // Dado: the shared NestJS authentication module
  // Quando: Identity or Order Workflow receives GraphQL or HTTP traffic
  // Então: an injectable guard uses Better Auth `verifyAccessTokenRequest`, exposes typed verified claims in the execution context, and metadata-driven scope guards remain reusable by resolvers
  assert.fail('critério de aceite AC-176 ainda não provado — implemente este teste');
});

// US-089 — Use Spring Security at the Java boundary
test('AC-177: Payment is a standard Spring OAuth resource server @spec:AC-177', async () => {
  // Dado: the Payment GraphQL federation endpoint
  // Quando: a bearer token reaches the Java runtime
  // Então: Spring Security validates signature, issuer, audience, expiry, and required scopes before GraphQL business code, with no static federation-secret interceptor
  const [build, security, controller, graphql, application] = await Promise.all([
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
    readFile('apps/payment-federation/src/main/resources/application.yaml', 'utf8'),
  ]);

  assert.match(build, /spring-boot-starter-oauth2-resource-server/);
  assert.match(security, /@EnableMethodSecurity/);
  assert.match(security, /requestMatchers\("\/graphql"\)\.authenticated\(\)/);
  assert.match(security, /oauth2ResourceServer\(oauth2 -> oauth2\.jwt\(/);
  assert.match(controller, /@PreAuthorize\("[^"]*hasAuthority\('SCOPE_orders:read'\)"\)/);
  assert.match(controller, /@PreAuthorize\("[^"]*hasAuthority\('SCOPE_cart:write'\)"\)/);
  assert.match(application, /issuer-uri: \$\{OAUTH_ISSUER:/);
  assert.match(application, /jwk-set-uri: \$\{IDENTITY_JWKS_URL:/);
  assert.match(application, /audiences:\n\s+- \$\{PAYMENT_OAUTH_AUDIENCE:https:\/\/payment\.marketplace\.local\}/);
  assert.doesNotMatch(`${graphql}\n${controller}`, /x-federation-secret|x-authenticated-subject|x-authenticated-scopes|WebGraphQlInterceptor/);
});

// US-090 — Keep streaming authentication equivalent to GraphQL
test('AC-178: SSE validates the same bearer token @spec:AC-178', () => {
  // Dado: the Gateway and Order Workflow SSE path
  // Quando: a subscription connection is opened
  // Então: the standard bearer credential is verified through the shared resource-server service and the verified subject owns the stream
  assert.fail('critério de aceite AC-178 ainda não provado — implemente este teste');
});

// US-091 — Turn native-first integration into a maintained rule
test('AC-179: Native-first boundaries are documented and executable @spec:AC-179', () => {
  // Dado: the Better Auth migration as a reference implementation
  // Quando: architecture documentation and quality tests are inspected
  // Então: they require native security/configuration/lifecycle facilities first, record any remaining custom gap, and prevent the removed identity-header protocol from returning
  assert.fail('critério de aceite AC-179 ainda não provado — implemente este teste');
});
