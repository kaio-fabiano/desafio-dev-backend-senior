# Tasks: Milestone 6 — Authenticated Apollo MCP
> feature: milestone-6-apollo-mcp

## T-041 — Define the curated GraphQL operation manifest [concluida]
- Refs: US-034, AC-060, AC-061
- Arquivos: apps/apollo-mcp/operations/me.graphql, apps/apollo-mcp/operations/search-products.graphql, apps/apollo-mcp/operations/get-product.graphql, apps/apollo-mcp/operations/get-my-cart.graphql, apps/apollo-mcp/operations/get-my-orders.graphql, apps/apollo-mcp/operations/add-to-cart.graphql, apps/apollo-mcp/mcp.yaml, test/milestone-6-mcp-operations.test.mjs
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Use only schema-backed named operations. Do not expose execute, introspection, checkout, payment, administration, supplier, or catalog mutation capabilities.

## T-042 — Configure the official self-hosted Apollo MCP Server [concluida]
- Refs: US-034, US-035, AC-060, AC-061, AC-062, AC-063
- Arquivos: apps/apollo-mcp/mcp.yaml, apps/apollo-mcp/schema.graphql, apps/apollo-mcp/Dockerfile, apps/apollo-mcp/project.json, docs/prds/08-riscos-e-decisoes-pendentes.md, test/milestone-6-mcp-config.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Pin 1.17.0, streamable HTTP, a versioned composed client schema with local operations, explicit issuer/audience/scopes, `allow_any_audience: false`, no GraphOS key, and close D-012 with MIT/container evidence. The artifact must be validated against the subgraph contracts in CI.

## T-043 — Seed MCP OAuth resources and scoped client grants [concluida]
- Refs: US-035, AC-062, AC-063, AC-064
- Arquivos: apps/identity-subgraph/src/auth/config.ts, apps/identity-subgraph/src/auth/seed.ts, test/fixtures/auth-server.ts, test/milestone-6-mcp-oauth.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Authentication is critical. Reuse ADR 002 and existing Better Auth resource patterns; prove MCP-only, gateway-only, multi-audience, expiry, issuer, and per-tool scopes.

## T-044 — Wire Apollo MCP to the gateway and Compose [concluida]
- Refs: US-036, AC-064, AC-065
- Arquivos: compose.yaml, apps/gateway/src/main.ts, apps/apollo-mcp/mcp.yaml, test/milestone-6-mcp-propagation.test.mjs, test/milestone-7-containers.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Forward the unchanged Authorization header to the gateway and keep gateway verification active. Add readiness without logging bearer values. Keep the Milestone 4 broker-port assertion scoped to the RabbitMQ service so the MCP transport can be published.

## T-045 — Assemble MCP protocol and parity acceptance [concluida]
- Refs: US-034, US-035, US-036, AC-060, AC-061, AC-062, AC-063, AC-064, AC-065, AC-066
- Arquivos: package.json, pnpm-lock.yaml, apps/e2e/project.json, test/milestone-6-apollo-mcp.test.mjs, docs/runbooks/milestone-6-apollo-mcp.md, docs/evidence/mcp/README.md, onpspec.config.json, .github/workflows/ci.yml
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Use an MCP protocol client for the automated gate and document Inspector steps. Compare the same token/fixtures through GraphQL and MCP; never store bearer tokens in evidence or logs.

## T-107 — Separate product discovery from singular lookup [concluida]
- Refs: US-034, AC-060, AC-066, AC-138
- Arquivos: apps/apollo-mcp/schema.graphql, apps/apollo-mcp/operations/search-products.graphql, test/milestone-6-mcp-config.test.mjs, test/milestone-6-mcp-operations.test.mjs, test/milestone-6-apollo-mcp.test.mjs, docs/prds/05-apollo-mcp.md
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Reuse the federated `products(first, after)` connection, keep `getProduct` as the only singular lookup, and prove both local operations against the pinned MCP schema.
