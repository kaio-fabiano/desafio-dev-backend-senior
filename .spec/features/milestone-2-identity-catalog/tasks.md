# Tasks: Milestone 2 — Identity and federated catalog

> feature: milestone-2-identity-catalog

## T-014 — Pin identity dependencies and reproducible configuration [pendente]

- Refs: US-015, AC-024
- Arquivos: package.json, pnpm-lock.yaml, apps/identity-subgraph/project.json, apps/identity-subgraph/src/auth/config.ts, apps/identity-subgraph/src/auth/seed.ts, test/milestone-2-oauth-bootstrap.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Authentication is critical. Pin versions, reuse PostgreSQL, and make the client seed idempotent; do not add a custom auth framework.

## T-015 — Validate tokens and derive the federated identity [pendente]

- Refs: US-016, US-017, AC-025, AC-026, AC-027
- Arquivos: apps/gateway/src/auth/token-verifier.ts, apps/gateway/src/auth/auth-context.ts, apps/identity-subgraph/src/graphql/identity.resolver.ts, apps/identity-subgraph/src/graphql/identity.module.ts, libs/contracts/graphql/identity/schema.graphql, test/milestone-2-token-me.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Validate issuer, audience, time, and scopes. Never accept caller-supplied identity headers.

## T-016 — Link registration to WordPress consistently [pendente]

- Refs: US-018, AC-028, AC-029
- Arquivos: apps/identity-subgraph/src/registration/sign-up-user.ts, apps/identity-subgraph/src/registration/wordpress-identity.port.ts, apps/identity-subgraph/src/registration/wordpress-identity.adapter.ts, test/milestone-2-registration.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Implement the smallest safe compensation supported by the pinned API; otherwise persist a non-login pending state proven by the test.

## T-017 — Enforce supplier-company ownership [pendente]

- Refs: US-019, AC-030
- Arquivos: apps/identity-subgraph/src/supplier/supplier-company.ts, apps/identity-subgraph/src/supplier/product-ownership.ts, libs/contracts/graphql/identity/schema.graphql, test/milestone-2-supplier-ownership.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Authorization is critical. Compare stable company ownership, not the creating user.

## T-018 — Publish the native Woo catalog through federation [pendente]

- Refs: US-020, AC-031
- Arquivos: apps/poc-wordpress/scripts/publish-subgraph.mjs, libs/contracts/graphql/catalog/schema.graphql, libs/contracts/graphql/supergraph.yaml, test/milestone-2-catalog-connection.test.mjs
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Plugin-first. Reuse native Woo Connections and only the deterministic SDL normalization proved in ADR 003.

## T-019 — Batch federated catalog references per request [pendente]

- Refs: US-021, AC-032
- Arquivos: apps/gateway/src/catalog/product-loader.ts, apps/gateway/src/catalog/request-metrics.ts, test/milestone-2-catalog-batching.test.mjs
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: One request-scoped loader and simple counters; no distributed cache or observability framework.

## T-020 — Assemble the Milestone 2 gateway gate [pendente]

- Refs: US-015, US-016, US-017, US-018, US-019, US-020, US-021, AC-024, AC-025, AC-026, AC-027, AC-028, AC-029, AC-030, AC-031, AC-032
- Arquivos: compose.yaml, onpspec.config.json, docs/runbooks/milestone-2-identity-catalog.md, test/milestone-2-identity-catalog.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Run the acceptance journey through the gateway. Reuse the existing Compose and test harness; add no second orchestration layer.
