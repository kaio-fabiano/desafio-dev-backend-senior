# Evidence: Modularize order workflow subgraph

## Red

- T-203: the GraphQL module ownership test failed because it still declared persistence and checkout providers.
- T-204: the same ownership test failed because the GraphQL module still declared order-event providers.
- T-205: the ownership test failed because the GraphQL module still owned the RabbitMQ runtime lifecycle.
- T-206: the application composition test failed because `AppModule` still imported `OrderWorkflowModule` instead of a transport-specific GraphQL module.

## Green and refactor

- Focused acceptance tests: PASS — 6/6.
- Order workflow project tests: PASS — 145 Vitest tests plus 10 Node acceptance/structural tests.
- Complete Vitest coverage suite: PASS — 267/267 tests; 99.61% lines/statements, 99.55% functions, and 98.03% branches overall.
- Order workflow refactor coverage: PASS — 100% lines/statements for the new modules, event boundary, saga repository/notifier, and GraphQL/SSE boundary.
- Typecheck: PASS — Nx `order-workflow-subgraph:typecheck`.
- Test typecheck: PASS — executed by Nx `order-workflow-subgraph:test`.
- Lint: PASS — Nx `order-workflow-subgraph:lint`.
- Build: PASS — Nx `order-workflow-subgraph:build`.

## Compatibility

No GraphQL schema, HTTP/SSE contract, migration, persisted entity shape, RabbitMQ topology, retry policy, DLQ behavior, or checkout rule was changed.
