# Federated platform architecture review

This walkthrough ties the delivered runtime topology and its deliberate design
choices to executable evidence. ADR 007 is the decision record; this document
is the review route and quality-gate ledger.

## Executable review contract

The JSON block is consumed by `test/federated-platform-quality.test.mjs`.

<!-- federated-platform-review:start -->

```json
{
  "qualityGates": [
    {
      "name": "Project quality",
      "command": "corepack pnpm@10.17.1 run quality:nx",
      "evidence": [
        "package.json",
        "nx.json",
        "test/milestone-7-nx-quality.test.mjs"
      ]
    },
    {
      "name": "Architecture",
      "command": "node --experimental-transform-types --test --test-reporter=tap test/architecture-boundaries.test.mjs test/federated-platform-refactor.test.mjs test/federated-platform-quality.test.mjs",
      "evidence": [
        "test/architecture-boundaries.test.mjs",
        "test/federated-platform-refactor.test.mjs",
        "test/federated-platform-quality.test.mjs"
      ]
    },
    {
      "name": "Composition",
      "command": "node --test --test-reporter=tap test/milestone-1-graphql-contracts.test.mjs",
      "evidence": [
        "libs/contracts/graphql/supergraph.yaml",
        "test/milestone-1-graphql-contracts.test.mjs"
      ]
    },
    {
      "name": "Unit and integration",
      "command": "node --experimental-transform-types --test --test-reporter=tap test/identity-federation-refactor.test.mjs test/gateway-federation-refactor.test.mjs test/wordpress-federation-refactor.test.mjs test/order-subscription-refactor.test.mjs",
      "evidence": [
        "test/identity-federation-refactor.test.mjs",
        "test/gateway-federation-refactor.test.mjs",
        "test/wordpress-federation-refactor.test.mjs",
        "test/order-subscription-refactor.test.mjs",
        "apps/payment-processor/src/test/java/dev/desafio/payment/PaymentFederationTest.java"
      ]
    },
    {
      "name": "Coverage",
      "command": "corepack pnpm@10.17.1 run quality:coverage",
      "evidence": [
        "test/milestone-7-coverage.test.mjs",
        "test/milestone-7-load.test.mjs"
      ]
    },
    {
      "name": "End-to-end",
      "command": "corepack pnpm@10.17.1 run acceptance:milestone-7",
      "evidence": [
        "test/milestone-7-e2e-contract.test.mjs",
        "apps/e2e/src/milestone-7.e2e.test.ts"
      ]
    }
  ],
  "runtimes": [
    {
      "name": "Apollo MCP",
      "path": "apps/apollo-mcp",
      "responsibility": "Expose curated authenticated graph operations to AI agents through Gateway.",
      "providerBoundary": "Apollo MCP configuration owns tool registration, OAuth validation, and the Gateway endpoint.",
      "domainDecision": "MCP is a stateless edge and uses the same federated contract as other clients.",
      "omittedAbstraction": "No MCP-specific domain model, persistence, or direct subgraph client.",
      "evidence": [
        "test/milestone-6-mcp-config.test.mjs",
        "test/milestone-6-mcp-oauth.test.mjs",
        "test/milestone-6-mcp-propagation.test.mjs"
      ]
    },
    {
      "name": "Gateway",
      "path": "apps/gateway",
      "responsibility": "Verify identity, propagate safe context, and execute the composed query and mutation graph.",
      "providerBoundary": "NestJS composes token verification, request context, Apollo Gateway, and the authenticated data source.",
      "domainDecision": "Authorization is propagated at the edge and enforced again by each owning federation.",
      "omittedAbstraction": "No catalog loader, business repository, commerce client, or subscription proxy.",
      "evidence": [
        "test/gateway-federation-refactor.test.mjs",
        "test/order-subscription-refactor.test.mjs"
      ]
    },
    {
      "name": "Identity Federation",
      "path": "apps/identity-subgraph",
      "responsibility": "Own identity, sessions, OAuth, registration, and identity graph fields.",
      "providerBoundary": "NestJSBetterAuth, injectable plugin factories, registration, and resolvers are composed by the Identity module.",
      "domainDecision": "Better Auth remains the sole owner and access path for users, accounts, sessions, and OAuth records.",
      "omittedAbstraction": "No custom PostgreSQL user repository or Identity MikroORM mapping mirrors Better Auth.",
      "evidence": [
        "test/identity-federation-refactor.test.mjs",
        "test/nest-provider-composition.test.mjs"
      ]
    },
    {
      "name": "Payment Federation",
      "path": "apps/payment-processor",
      "responsibility": "Own payment invariants, idempotent commands, dedicated read views, and payment graph fields.",
      "providerBoundary": "Spring configuration binds the aggregate handler, focused command/query handlers, JDBC view, and GraphQL Federation adapter.",
      "domainDecision": "Selective CQRS separates invariant-bearing writes from direct payment views without adding a command bus.",
      "omittedAbstraction": "No Axon, event sourcing, generic CQRS framework, or WooCommerce persistence access.",
      "evidence": [
        "apps/payment-processor/src/test/java/dev/desafio/payment/PaymentFederationTest.java",
        "test/architecture-boundaries.test.mjs"
      ]
    },
    {
      "name": "WordPress Federation",
      "path": "apps/wordpress-federation",
      "responsibility": "Expose authoritative catalog, cart, order, customer, inventory, and order-subscription capabilities.",
      "providerBoundary": "NestJS providers delegate to WPGraphQL and WooGraphQL and attach graphql-sse to the executable NestJS schema.",
      "domainDecision": "WordPress and WooCommerce remain the commercial system of record; the adapter uses pinned plugins, REST, and signed webhooks without custom WordPress PHP.",
      "omittedAbstraction": "No competing commercial repository, loader, CRUD model, Commerce runtime, Stock worker, or Gateway stream proxy.",
      "evidence": [
        "test/wordpress-federation-refactor.test.mjs",
        "test/order-subscription-refactor.test.mjs"
      ]
    }
  ]
}
```

<!-- federated-platform-review:end -->

## Walkthrough order

1. **Topology:** compare ADR 007 with the Nx project graph. Five applications
   deploy; `apps/e2e` supplies proof and `apps/wordpress-integration` supplies
   reproducible WordPress assets.
2. **Dependency direction:** run the Architecture gate. Domain and application
   sources point inward; framework, persistence, GraphQL, WordPress, and
   messaging imports remain in adapters or composition.
3. **Provider composition:** inspect the thin application bootstraps, then the
   NestJS and Spring composition modules named above. Bootstraps create and
   close framework applications; they do not assemble infrastructure graphs.
4. **Ownership:** trace Better Auth records to Identity, payment invariants to
   Payment, and commercial state plus SSE delivery to WordPress Federation.
5. **External contract:** compose the SDL, exercise focused tests, then run the
   isolated E2E journey through Gateway, WordPress SSE, and Apollo MCP.

## Deliberate design choices

- DDD is expressed as explicit context ownership and inward dependency
  direction, not a generic framework.
- CQRS exists only in Payment because command execution loads an aggregate and
  enforces invariants while the query returns a dedicated view directly.
- Dependency injection is the application boundary: NestJS providers and
  Spring beans own construction, configuration, lifecycle, and adapters.
- Existing libraries are selected before custom code: NestJSBetterAuth owns
  Better Auth integration, Apollo Gateway composes the graph, Spring GraphQL
  supplies federation support, WPGraphQL/WooGraphQL own commercial behavior,
  and `graphql-sse` owns the stream protocol.
- MikroORM is omitted from Identity because Better Auth owns those records. A
  future first-party Identity model would need its own failing requirement
  before persistence is added.

## Local verification ledger

This ledger records the previously completed execution on 2026-08-30 and the
T-080 rerun on 2026-08-31. Focused tests do not substitute for the complete
verification command.

| Gate                               | Result       | Evidence                                                                                                              |
| ---------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| Federated-platform focused suite   | PASS (25/25) | Architecture, provider composition, Identity, Gateway, WordPress, Payment, subscriptions, topology, and quality tests |
| Payment Spring integration suite   | PASS (9/9)   | `PaymentFederationTest` and the Payment application tests                                                             |
| Isolated Vitest/Testcontainers E2E | PASS (5/5)   | Card, Pix, authenticated SSE, persistent reads, and Apollo MCP parity                                                 |
| Feature spec verification          | PASS (14/14) | `onp-spec verify federated-platform-architecture-refactor`; 238 tests parsed                                          |
| Historical spec verification       | PASS         | All eleven stale feature proofs were rerun against the same 238-test repository command                               |
| Repository spec audit              | PASS         | `onp-spec audit --ci`; 103/103 criteria tested, 103/103 proved, zero warnings                                         |

### Pull-request gate recovery

The clean-install failure was resolved by exporting the reusable NestJS
libraries from the workspace package and importing those public entry points
from each application. Runtime images now include the exported workspace
sources, so Node resolves the same package contract locally and in Compose.
The exact Nx CI matrix passes for all fourteen projects, and the feature
verification passes all fourteen criteria after parsing 238 tests. PR #2
remains unmerged until its remote required checks confirm the same result.

## Completed work previously recorded as blocked

- The complete regression now includes the feature-specific AC-090 through
  AC-103 tests, and the spec parser recognizes all fourteen criteria.
- The WordPress integration probe uses a workspace-mounted temporary directory,
  allowing its nested Docker daemon to mount generated plugin assets.
- Identity registration creates or reuses the WooCommerce customer. WordPress
  Federation exchanges its propagated WordPress user id through Headless
  Login's server-only Site Token provider.
- Gateway propagates the WooCommerce session headers and response cookies needed
  by native cart and checkout operations without taking ownership of commerce.
- Native WooGraphQL owns checkout and order reads; Payment writes transitions
  through authenticated WooCommerce REST.
- Payment persistence and read/write providers are owned by Spring
  `PaymentConfiguration` and are enabled only when a datasource is configured.
- Signed WooCommerce order webhooks feed the order stream, which is
  authenticated and served directly by WordPress Federation
  through the executable NestJS GraphQL schema and the official `graphql-sse`
  handler; Gateway does not proxy it.
- Compose enables the reproducible checkout path and declares the required
  identity, WordPress, Payment, Gateway, and MCP dependencies.

Generated Gradle directories and pre-existing local containers are workspace
housekeeping, not delivery evidence.
