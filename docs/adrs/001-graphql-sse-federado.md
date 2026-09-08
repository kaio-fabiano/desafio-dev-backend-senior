# ADR 001: GraphQL subscriptions over SSE at the federated edge

- Status: accepted for implementation
- Date: 2026-08-26

## Context

The gateway must expose GraphQL subscriptions through the `graphql-sse`
protocol, not Apollo Router's multipart HTTP transport. The proof evaluates
`@apollo/gateway` 2.14.4, `@apollo/subgraph` 2.14.4, `graphql` 16.11.0, and
`graphql-sse` 2.6.1.

`@apollo/gateway` composes and executes federated queries, but it does not
provide a `graphql-sse` subscription transport. Apollo Server also leaves
subscription transport to an integration. Treating multipart HTTP as SSE would
therefore create a false compatibility result.

## Decision

Adopt the `hybrid-graphql-sse-edge` pipeline. Apollo Gateway composes the
Federation v2 schema for the normal graph. A colocated `graphql-sse` handler
owns the subscription endpoint and delegates the operation to the owning
Federation v2 subgraph with a `graphql-sse` client. This is the smallest
verified alternative and keeps authentication at the same edge boundary.

## Evidence

Run:

```sh
corepack pnpm@10.17.1 exec nx run @desafio-dev-backend-senior/order-workflow-subgraph:test
node --test --test-reporter=tap test/resolve-gateway-sse-todos.test.mjs
corepack pnpm@10.17.1 exec nx run @desafio-dev-backend-senior/e2e:acceptance
```

The current integration suite at
`apps/order-workflow-subgraph/src/graphql/sse/sse.integration.spec.ts`
exercises the authenticated owner stream through the production Order Workflow
SSE handler and event broker, including scope rejection, disconnect cleanup,
and checkout propagation. The Gateway structural test pins the colocated
authenticated route, and the end-to-end acceptance suite proves the complete
deployed journey.

## Consequences

- Do not label Apollo multipart responses as SSE.
- Production code must replace the proof's in-memory event source with the
  project event broker and apply gateway authentication before delegation.
- Re-evaluate the adapter when the selected Node gateway directly supports the
  `graphql-sse` protocol.
