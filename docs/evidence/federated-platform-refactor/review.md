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
      "domainDecision": "WordPress and WooCommerce remain the commercial system of record; custom code covers only a tested compatibility gap.",
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

Update this table only from a clean local execution. A non-zero command remains
failed; focused tests never substitute for the complete gate.

| Gate                                          | Result               | Evidence                                                                                                   |
| --------------------------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------- |
| T-073 focused architecture documentation test | PASS (1/1)           | `node --test --test-reporter=tap test/federated-platform-quality.test.mjs` on 2026-08-28                   |
| Focused federated-platform architecture suite | PASS (18/18)         | Architecture boundaries, federation refactors, provider composition, and T-073 quality proof on 2026-08-28 |
| Project quality                               | FAIL (34/39 targets) | `quality:nx` failures listed below                                                                         |
| Complete repository regression command        | FAIL                 | Its first segment fails AC-007; independently executed later segments found the additional failures below  |
| Isolated Vitest/Testcontainers E2E            | FAIL                 | Topology setup fails and all five scenarios are skipped, so this is not acceptance evidence                |

## Blocking gate findings

These findings are recorded rather than hidden by a narrower green test. Their
fixes are outside the T-073 documentation and quality-test file boundary.

- AC-007 expects `onpspec.config.json` parallelism without the configured
  `sandbox` field. The complete chained regression therefore stops in
  `test/project-planning-memory.test.mjs`.
- Milestone 1 local infrastructure fails because the Identity container cannot
  resolve `/workspace/libs/identity/nest/src/index.ts`; its Docker build does
  not make that project available to the runtime image.
- `quality:nx` reports 34 of 39 targets successful. Gateway, Identity, and
  WordPress Federation lint reject relative cross-project imports in their
  composition roots. Platform NestJS typecheck/build cannot resolve the Node
  type definitions.
- The final Vitest/Testcontainers acceptance suite cannot establish its
  topology. Its five scenarios are skipped after setup failure, which counts as
  a failed gate under this review contract.

The independently executed Marco 0 and Milestone 2 through Milestone 8 Node
test segments passed. Those results narrow the blockers but do not turn the
complete regression command green.
