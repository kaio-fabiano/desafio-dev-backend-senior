# Design: Milestone 8 — Challenge compliance and production hardening

## Review conclusion

The repository contains useful domain components and strong contract coverage, but the final acceptance test is a parallel in-memory implementation. Production NestJS modules are not wired to GraphQL or Better Auth, the Identity SDL lacks mandatory operations, and workspace lint/build are not reproducible. The challenge README is the upstream contract and tests must execute the submitted runtime.

## Dependency direction

```text
presentation (GraphQL, HTTP, RabbitMQ consumers)
    -> application (use cases and transaction boundaries)
        -> domain (entities, value objects, invariants, domain events)
application ports <- infrastructure adapters (MikroORM, WooCommerce, RabbitMQ, Better Auth)
```

Domain code must not import NestJS, GraphQL, MikroORM, RabbitMQ, fetch, filesystem, or environment configuration. Ports are justified only at external boundaries. Nest modules are composition roots and contain no business decisions.

## Runtime topology

- Gateway composes versioned Federation v2 subgraphs and owns edge authentication plus client-facing GraphQL SSE.
- Identity owns Better Auth, OAuth endpoints, identity persistence, supplier membership, and `users`, `user`, and `me`.
- Commerce owns carts, checkout operations, workflows, outbox/inbox, saga transitions, and subgraph SSE.
- WordPress/WooCommerce remains the catalog and commercial-order system of record.
- Payment and stock workers consume RabbitMQ independently and persist deduplication before acknowledging.
- Apollo MCP targets only the Gateway with an explicit operation allowlist.

## Test strategy

Unit tests protect domain invariants. Integration tests exercise real adapters against ephemeral dependencies. Final Vitest/Testcontainers acceptance builds and starts the same Dockerfiles used by Compose and SST; it must not contain a second marketplace implementation. Architecture and quality checks complement behavior tests but cannot replace them.

## AWS boundary

SST configuration and TypeScript are validated without credentials. `sst deploy` remains protected and requires separately configured credentials and explicit authorization.
