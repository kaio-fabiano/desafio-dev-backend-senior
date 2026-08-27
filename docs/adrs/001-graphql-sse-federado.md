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
pnpm nx run @desafio-dev-backend-senior/poc-sse:probe
pnpm nx run @desafio-dev-backend-senior/poc-sse:test:spec
```

The probe starts both servers on ephemeral loopback ports, subscribes through
the gateway, and emits one order event from the subgraph. It reports
`text/event-stream` for both the client-to-edge and edge-to-subgraph legs and
returns the event payload. The acceptance test also pins the adopted decision
and the evaluated versions.

## Consequences

- Do not label Apollo multipart responses as SSE.
- Production code must replace the proof's in-memory event source with the
  project event broker and apply gateway authentication before delegation.
- Re-evaluate the adapter when the selected Node gateway directly supports the
  `graphql-sse` protocol.
