# Structural improvement review

This review followed the active request path from Gateway through Identity,
Commerce, Payment, WordPress, and Apollo MCP. The accepted changes keep the
Gateway transport-only, make propagated identity trustworthy between services,
scope WordPress session headers to WordPress, bind private Commerce reads to the
authenticated subject, and make checkout inputs and concurrent retries
deterministic.

WordPress remains a native plugin-backed subgraph. Its bootstrap is convergent,
its diagnostic logging is restored after failures, and no Node federation proxy
or custom schema publisher is part of the runtime.

The delivery path now runs only existing Nx targets and the real Compose
acceptance journey. Production SST deployment is intentionally fail-closed with
`SST_TOPOLOGY_READY` because the checked-in stack is still a validation scaffold,
not a complete representation of the local topology.

## Deferred work

- Persist payment ownership before exposing arbitrary payment lookup by ID.
- Publish the Payment GraphQL outbox through the same durable RabbitMQ boundary.
- Replace process-local subscription delivery and inventory idempotency with
  durable, replica-safe mechanisms.
- Complete SST resources, secret mappings, dependency readiness, and a
  post-deploy smoke test before enabling production deployment.
- Add dependency-loss readiness and observable trace smoke tests.

These items require schema or deployment design changes and are not disguised as
cleanup in this review.
