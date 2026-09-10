# Tasks: Modularize order workflow subgraph

> feature: modularize-order-workflow-subgraph

## T-203 — Extract persistence and checkout modules [concluida]
- Refs: US-117, AC-246, AC-247, AC-251
- Arquivos: docs/runbooks/java-axon-order-workflow-operations.md
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: Red proves module provider ownership and exported dependencies. Green moves ORM/request EntityManager tokens and checkout providers into focused NestJS modules without changing implementation behavior. Keep temporary imports only when required to maintain a green intermediate state; remove them in T-206.

## T-204 — Create the order-events module and align transport files [concluida]
- Refs: US-117, AC-248, AC-251
- Arquivos: docs/runbooks/java-axon-order-workflow-operations.md
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: After T-203. Red proves module ownership plus unchanged SSE authorization, replay, and delivery. Green renames `subscriptions` to `order-events`, groups PostgreSQL adapters below that resource, moves SSE handlers and middleware to the GraphQL transport folder, and adds `OrderEventsModule`. Do not change event semantics.

## T-205 — Extract messaging composition and saga collaborators [concluida]
- Refs: US-117, AC-249, AC-251
- Arquivos: docs/runbooks/java-axon-order-workflow-operations.md
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: After T-204. Red proves the focused consumer collaborators and module lifecycle wiring while retaining existing runtime integration coverage. Green creates `MessagingModule` and separates saga persistence and PostgreSQL notification from message consumption. Preserve acknowledgement, reconnect, shutdown, retry, DLQ, inbox, and outbox behavior exactly.

## T-206 — Finalize the application composition root [concluida]
- Refs: US-117, AC-246, AC-247, AC-248, AC-249, AC-250, AC-251
- Arquivos: docs/runbooks/java-axon-order-workflow-operations.md, test/order-workflow-e2e.test.mjs, test/production-happy-path-hardening.test.mjs, test/production-happy-path-hardening.spec.test.js, test/oauth-resource-server-auth.spec.test.mjs, test/document-sse-bootstrap-simplification.test.mjs, test/mercado-pago-production-deployment.test.mjs, test/modularize-order-workflow-subgraph.test.mjs, test/resolve-node-review-inventory.test.mjs, .spec/features/resolve-node-review-todos/inventory.json, docs/reviews/node-todo-resolution.md, vitest.config.ts, .spec/features/modularize-order-workflow-subgraph/evidence.md
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notas: After T-205. Red proves that `AppModule` is the composition root and the GraphQL module owns transport providers only. Green replaces the monolithic module, removes obsolete GraphQL-owned tokens, relocates shared types to neutral owning resources where necessary, and updates all imports. Refactor runs the complete project gates and records evidence without changing public behavior.
