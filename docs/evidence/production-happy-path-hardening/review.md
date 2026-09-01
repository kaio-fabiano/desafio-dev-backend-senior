# Production happy path hardening review

## Quality gates

- Focused tests: PASS
- ESLint: PASS
- Typecheck: PASS
- Code review: PASS

## Review loop

- T-102: fixed MCP schema drift, added sink-side session-header allowlisting,
  replaced positional subgraph flags, and proved response-to-replica propagation.
- T-103: reviewed durable owner leases, stable WooCommerce references,
  ambiguous-result reconciliation, and migration rollback.
- T-104: reviewed claim-before-effect, WooCommerce reconciliation, atomic
  inbox/outbox completion, listener acknowledgement order, and removal of locks.
- T-105: replaced post-commit process-local publication with transactional
  `pg_notify`, persisted snapshot replay, disconnect-driven SSE reconnection,
  validated bounded notification identifiers, relay readiness, and versioned
  replay/live ordering.
- T-106: moved Nest boundaries to idiomatic decorators, guards, parameter
  decorators, lifecycle providers, explicit ports/tokens, and architecture tests.
  A second review found and closed explicit DI, HTTP guard bypass, monotonic
  replay ordering, RabbitMQ recovery, exception-safe teardown, and test-target
  coverage findings.
- The final review required inventory reconciliation to match the durable
  `inventory_operation_key`, routed ownership conflicts directly to the dead
  letter exchange, stopped card payment from completing the order before stock
  reservation, distinguished payment-driven order status from inventory
  ownership, and made shutdown await an in-flight reconnect. The complete
  verification suite passed again after these corrections.

## Runtime smoke

- The production Commerce image starts with real PostgreSQL and RabbitMQ.
- `/health` remains public and `/ready` validates ORM, RabbitMQ, and the
  PostgreSQL notification relay.
- GraphQL operations reject an invalid federation secret and an authenticated
  checkout lookup resolves through the request-scoped provider graph.
- Stopping RabbitMQ makes readiness return 503; restarting it restores readiness
  through the lifecycle provider's reconnect loop.

The final command transcript is recorded after the repository-wide gates run.

## Final command transcript

- `nx run-many --target=lint --all --skip-nx-cache`: PASS, zero errors.
- `nx run @desafio-dev-backend-senior/order-workflow-subgraph:test --skip-nx-cache`: PASS.
- `gradle --no-daemon test`: PASS.
- Milestone 7 real Compose acceptance: PASS, 6/6 tests.
- `onp-spec verify production-happy-path-hardening`: PASS, 7/7 criteria,
  127 tests parsed, exit 0.
- `onp-spec audit --ci`: PASS, 93/93 criteria proved, zero warnings.
