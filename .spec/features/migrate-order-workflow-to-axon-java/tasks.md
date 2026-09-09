# Tasks: Audit and Plan the Java/Axon Migration

> feature: migrate-order-workflow-to-axon-java

## T-240 — Audit the current Java runtime and Axon 5 reference [concluida]
- Refs: US-132, US-133
- Arquivos: apps/payment-federation, ../axon-graphql-posts, .spec/features/migrate-order-workflow-to-axon-java/audit-current-java.md
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Documentation-only audit. Treat `/home/kaiosilva/Downloads/PROMPT_PLANO_REFATORACAO_JAVA_AXON5_RABBITMQ.md`, `/home/kaiosilva/Downloads/TESTING_REQUIREMENTS.md`, and `/home/kaiosilva/Downloads/README_REFACTOR_PLAN_FILES.md` as authoritative requirements. Inspect the real Java packages, dependencies, GraphQL API, persistence, messaging, external adapters, migrations, tests, and Docker configuration. Compare verified Axon 5.3 patterns from the local reference without changing production code. Record exact evidence, classifications, incompatibilities, and every item that still NEEDS VALIDATION.

## T-241 — Audit the current Workflow and integration contracts [concluida]
- Refs: US-134, US-135, US-136
- Arquivos: apps/order-workflow-subgraph, apps/gateway, apps/identity-subgraph, apps/wordpress-integration, libs/contracts, compose.yaml, .spec/features/migrate-order-workflow-to-axon-java/audit-current-workflow.md
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Documentation-only audit, parallel with T-240. Treat the three approved source documents under `/home/kaiosilva/Downloads/` as authoritative requirements. Inventory behavior and contracts that the Java migration must preserve: checkout idempotency, state transitions, choreography, inbox/outbox, RabbitMQ topology, GraphQL Federation, OAuth ownership, SSE replay, WordPress/WooCommerce integration, schemas, tables, deployment, and tests. Do not alter production code.

## T-242 — Design the evidence-backed target architecture [concluida]
- Refs: US-132, US-133, US-134, US-135, US-136
- Arquivos: .spec/features/migrate-order-workflow-to-axon-java/spec.md, .spec/features/migrate-order-workflow-to-axon-java/design.md, .spec/features/migrate-order-workflow-to-axon-java/refactor-audit-and-plan.md, docs/architecture/target-java-axon-architecture.svg
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: After T-240 and T-241. Reconcile the audited facts with the three approved source documents under `/home/kaiosilva/Downloads/`. Define the bounded-context map, strict choreographed saga, domain and integration event separation, command catalog, RabbitMQ topology, CQRS projections, SSE flow, database ownership matrix, Axon persistence decision or NEEDS VALIDATION marker, migration constraints, risks, and blockers. No production implementation.

## T-243 — Produce the traceable phased implementation plan [concluida]
- Refs: US-132, US-133, US-134, US-135, US-136
- Arquivos: .spec/features/migrate-order-workflow-to-axon-java/tasks.md, .spec/features/migrate-order-workflow-to-axon-java/refactor-audit-and-plan.md, .spec/features/migrate-order-workflow-to-axon-java/testing-matrix.md
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: After T-242. Preserve T-240 through T-243 for audit provenance and append the executable implementation phases to this file. Every implementation task must declare model, effort, dependencies, bounded context, use case, aggregate or explicit absence, invariants, consistency boundary, affected ports, files, Red/Green/Refactor tests, validation commands, acceptance criteria, risks, blockers, and rollback. Produce the requirement-to-test matrix and objective Definition of Done. Do not implement the refactor.

## T-244 — Prove the Axon 5 persistence and architecture baseline [concluida]
- Refs: US-132, AC-280, AC-282, AC-292
- Arquivos: apps/payment-federation/build.gradle.kts, apps/payment-federation/project.json, apps/payment-federation/src/main/java/dev/desafio/transaction, apps/payment-federation/src/main/resources/application.yaml, apps/payment-federation/src/main/resources/db/migration, apps/payment-federation/src/test/java/dev/desafio/transaction/architecture, apps/payment-federation/src/test/java/dev/desafio/transaction/infrastructure/axon, apps/payment-federation/src/test/java/dev/desafio/transaction/infrastructure/persistence, test/migrate-order-workflow-to-axon-java.test.mjs, onpspec.config.json
- Modelo: gpt-5.6-sol
- Esforço: alto
- Dependencies: T-243. This is a hard prerequisite for every later implementation task.
- Objective: Pin Axon Framework and Reactor 5.3.1, select and prove a supported PostgreSQL-backed event/token/processor persistence implementation, establish context package rules, and create schema-qualified Flyway and Testcontainers foundations. Do not copy the reference's in-memory stores or SQLite auto-DDL.
- Bounded context: Shared Axon/persistence technical boundary plus Transaction, Inventory, and Payment ownership governance.
- Use case: Persist and reconstruct event-sourced state across restart and replicas while preventing architectural and database-boundary violations.
- Aggregate: None for the architecture/schema harness; one minimal disposable validation entity may be used only to prove the selected Axon storage contract and must not become a speculative shared aggregate.
- Invariants: Java 21 and Axon 5.3.1 only; no Axon 4 artifact; Domain imports no outer technology except the explicitly allowlisted proven Axon 5 event-sourcing metadata; one PostgreSQL instance has exclusively owned `transaction`, `inventory`, and `payment` schemas; no cross-schema query, join, foreign key, or JPA association; event and processor positions survive restart; concurrent writes preserve stream consistency.
- Consistency boundary: One Axon event stream plus its processor position for persistence proof; one Flyway history per approved schema ownership model.
- Affected ports: Axon event storage/processor infrastructure, datasource/migration boundary; no business external port.
- Behavior: An empty PostgreSQL container migrates from zero, the Java application starts without auto-DDL, a persisted event reconstructs after restart, processor progress resumes without duplicate observable effects, and ArchUnit rejects forbidden layer/context imports and hidden orchestrator shapes.
- Red: Add focused JUnit tests and a TAP evidence adapter annotated with `@spec:AC-280`, `@spec:AC-282`, and `@spec:AC-292`. They fail because Axon is absent, persistence is not durable, schemas are unqualified, H2 is present, current architecture enforcement is incomplete, and `onp-spec verify` cannot otherwise ingest JUnit evidence. Record the expected behavioral failure before production edits.
- Green: Add only dependencies/configuration/migrations required by the proven Axon 5.3.1 persistence choice, PostgreSQL Testcontainers, and ArchUnit rules; make the focused tests pass. Record exact Axon tables, schema, transaction manager, restart semantics, sequencing, token/dead-letter support, and any unsupported capability as `NOT VERIFIED`.
- Refactor: Remove H2-as-PostgreSQL coverage and duplicated regex architecture scanning only after equivalent or stronger tests pass; keep the complete current Java suite green.
- Validation: `./gradlew :apps:payment-federation:cleanTest :apps:payment-federation:test`; `./gradlew :apps:payment-federation:jacocoTestReport`; `npx nx run payment-federation:build`; `npx nx run payment-federation:lint`; run the focused Axon restart/concurrency and migration tests twice against fresh PostgreSQL containers; run the TAP evidence adapter and confirm it reports the JUnit-backed AC tags; `node .agents/skills/onp-spec-driven/scripts/onp-spec.mjs verify migrate-order-workflow-to-axon-java`; `node .agents/skills/onp-spec-driven/scripts/onp-spec.mjs audit`.
- Acceptance: AC-280 and AC-282 annotated tests pass; resolved dependency evidence contains Axon 5.3.1 and no Axon 4; database ownership is executable; every persistence claim has a test or `NOT VERIFIED` record. No later phase starts before this gate is green.
- Risks/blockers: Open Q-019 blocks Green until a supported persistent implementation and exact schema/transaction behavior are proven. Unsupported Axon persistence, token, or dead-letter semantics must stop the migration rather than be invented.
- Rollback: Revert this isolated dependency/configuration/migration slice before any business stream exists; retain characterization tests and the written persistence evidence.

## T-245 — Establish versioned contracts and reliable AMQP boundaries [concluida]
- Refs: US-132, US-133, AC-280, AC-293, AC-292
- Arquivos: libs/contracts/events, apps/payment-federation/src/main/java/dev/desafio/transaction/contracts/integration/v1, apps/payment-federation/src/main/java/dev/desafio/transaction/configuration, apps/payment-federation/src/main/java/dev/desafio/transaction/shared/infrastructure/messaging, apps/payment-federation/src/main/java/dev/desafio/transaction/shared/infrastructure/persistence, apps/payment-federation/src/main/resources/db/migration, apps/payment-federation/src/test/java/dev/desafio/transaction/contracts, apps/payment-federation/src/test/java/dev/desafio/transaction/infrastructure/messaging, apps/payment-federation/src/test/java/dev/desafio/transaction/payment/application/ArchitectureBoundariesTest.java, test/migrate-order-workflow-to-axon-java.test.mjs, test/mercado-pago-payment-provider.spec.test.mjs, test/payment-federation-clean-architecture.spec.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Dependencies: T-244.
- Objective: Define the V1 Integration Event envelope and implement the shared Spring AMQP infrastructure pattern, with context-owned inbox/outbox storage, publisher confirms, manual acknowledgement, bounded retry, and per-consumer DLQ.
- Bounded context: Versioned integration-contract technical boundary; Transaction, Inventory, and Payment own their queues and inbox/outbox rows independently.
- Use case: Reliably publish and consume a cross-context fact at least once without exposing Domain Events or duplicating local business effects.
- Aggregate: None; this phase handles transport contracts and durable delivery around later aggregate commands.
- Invariants: Envelope includes `eventId`, `eventType`, `version`, `aggregateId`, `transactionId`, `correlationId`, `causationId`, `occurredAt`, and typed payload; consumer identity plus event ID is unique; ACK follows durable local completion; original body and causal headers survive retry/DLQ; business rejection is ACKed, not retried; no listener contains domain decisions; no reusable provider credential enters a general event.
- Consistency boundary: One context-local inbox transaction for each received event and one context-local outbox row keyed by the source event; RabbitMQ confirmation is intentionally outside the database transaction and duplicates remain safe.
- Affected ports: Integration-event serializer/validator, inbox, outbox, AMQP publisher, AMQP inbound command dispatcher, clock/identifier source.
- Behavior: `marketplace.events.v1`, `marketplace.retry.v1`, context queues, 1/10/60-second retry queues, and per-consumer DLQs are declared; a pending outbox row publishes after broker recovery; duplicate delivery has one durable local disposition; invalid/poison messages reach DLQ with replayable metadata.
- Red: Add `@spec:AC-293`, `@spec:AC-280`, and supporting `@spec:AC-292` contract/integration tests against PostgreSQL and RabbitMQ Testcontainers. Demonstrate failures for missing causal fields, absent relay, duplicate processing, unconfirmed routing, and lossy DLQ metadata.
- Green: Implement the minimum versioned records/mappers, schema-owned tables, relays/listeners, and Spring configuration needed for those tests. Reuse the installed Spring AMQP stack; do not add `axon-amqp`.
- Refactor: Extract only repeated topology/envelope mechanics that have at least two real consumers; keep context-specific bindings and commands explicit.
- Validation: `./gradlew :apps:payment-federation:test --tests '*Contract*' --tests '*Rabbit*' --tests '*Inbox*' --tests '*Outbox*'`; `./gradlew :apps:payment-federation:test`; `npx nx run payment-federation:build`; `npx nx run payment-federation:lint`; onp-spec verify and non-CI audit commands from T-244.
- Acceptance: AC-293 passes over real RabbitMQ/PostgreSQL; outage, redelivery, retry, DLQ, serialization, headers, publisher confirm, and mandatory routing are proven; no cross-context in-process dispatch exists.
- Risks/blockers: Amazon MQ TLS, permissions, quorum support, HA, and operational replay remain `NOT VERIFIED` until environment evidence exists; Q-026 forbids sensitive payment tokens in Integration Events and permits only opaque provider references.
- Rollback: Disable the new queues/listeners and revert new V1 bindings/migrations while retaining existing routing keys; no business flow has switched yet.

## T-246 — Convert Inventory into an independent Axon participant [concluida]
- Refs: US-132, US-133, AC-281, AC-282, AC-284, AC-293, AC-292
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/inventory, apps/payment-federation/src/main/resources/db/migration/inventory, apps/payment-federation/src/test/java/dev/desafio/transaction/inventory, test/migrate-order-workflow-to-axon-java-inventory.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Dependencies: T-244, T-245.
- Objective: Replace the transport-shaped Inventory service with an event-sourced `InventoryReservation` decision model that independently reserves, commits, and releases stock.
- Bounded context: Inventory.
- Use case: React to `OrderReceived`, `PaymentApproved`, `PaymentRejected`, and cancellation facts with one local command and publish only Inventory-owned results.
- Aggregate: `InventoryReservation`.
- Invariants: One reservation per transaction/SKU set; quantities are positive; stock cannot be over-reserved; duplicate reserve/commit/release is idempotent; commit and release cannot both succeed; stale/out-of-order events cannot regress state; the last unit has one winner.
- Consistency boundary: One Inventory reservation stream plus Inventory-owned effect/claim, inbox, outbox, and projection rows; WooCommerce remains external through `StockPort`.
- Affected ports: `StockPort`, Inventory inbox/outbox, Inventory projection repository, AMQP inbound/outbound adapters, controllable clock/IDs.
- Behavior: Axon commands cause valid Domain Events; sourcing handlers perform no I/O; external stock effects use durable operation identity and reconciliation; replay recreates state; integration mappers emit reserved/rejected/committed/released facts.
- Red: Add pure domain and Axon 5 fixture tests annotated `@spec:AC-281`, `@spec:AC-282`, and `@spec:AC-284`, including duplicate, out-of-order, replay, no-side-effect replay, and concurrent last-unit scenarios; add PostgreSQL adapter tests for durable effect reconciliation.
- Green: Implement only the Inventory model, handlers, ports/adapters, projection, and Integration Event mappings required by the failing tests; remove transport envelope types from Inventory domain.
- Refactor: Split the current listener/repository only along command, stock-effect, projection, inbox, and outbox responsibilities; delete obsolete Inventory service paths after all characterization tests have an equivalent proof.
- Validation: `./gradlew :apps:payment-federation:test --tests '*inventory*'`; `./gradlew :apps:payment-federation:test`; `./gradlew :apps:payment-federation:jacocoTestReport`; build, lint, onp-spec verify, and non-CI audit.
- Acceptance: Inventory tests prove all AC-284 delivery modes and AC-282 replay/durability; no Payment or Transaction internal type/import/call appears in Inventory; emitted messages are Inventory-owned V1 contracts.
- Risks/blockers: Woo stock API ambiguity and replica ordering require executable reconciliation/concurrency evidence; do not use `synchronized` as distributed consistency.
- Rollback: Keep legacy Inventory bindings available and route one writer at a time; revert bindings to the legacy consumer while leaving the new projection/read data unused.

## T-247 — Convert Payment and provider effects into Axon [concluida]
- Refs: US-132, US-133, AC-281, AC-282, AC-283, AC-293, AC-292
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/payment, apps/payment-federation/src/main/resources/db/migration/payment, apps/payment-federation/src/test/java/dev/desafio/transaction/payment, test/migrate-order-workflow-to-axon-java-payment.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Dependencies: T-244, T-245. May proceed independently of T-246 until choreography tests.
- Objective: Convert Payment to an event-sourced aggregate and a durable provider-effect protocol that reacts only to `InventoryReserved` for the target happy path.
- Bounded context: Payment.
- Use case: Request, pend, approve, reject, refund, and reconcile a Mercado Pago payment without duplicate external effects or direct WordPress/Inventory calls.
- Aggregate: `Payment`.
- Invariants: Amount/currency/external transaction reference are immutable; valid status transitions only; one provider effect/idempotency key per intent; approval and refund are idempotent; refund requires approval; HTTP success alone never means approved; duplicated webhooks and messages have one outcome.
- Consistency boundary: One Payment event stream plus Payment-owned provider-effect ledger, notification inbox, integration inbox/outbox, and projection rows.
- Affected ports: `PaymentProvider`, provider notification verification, Payment effect repository, Payment projection repository, inbox/outbox, AMQP adapters, clock/IDs.
- Behavior: A durable `PaymentRequested` fact precedes provider I/O; provider outcomes return through local commands; Mercado Pago stays behind its adapter; Payment emits pending/approved/rejected/refunded Integration Events and never updates WordPress directly.
- Red: Add pure domain/Axon fixture and adapter tests annotated `@spec:AC-281`, `@spec:AC-282`, and `@spec:AC-283`; cover card, Pix, pending, approved, rejected, refund, invalid refund, duplicate/conflicting intent, timeout-after-provider-success, duplicate webhook, idempotency key, replay, and sourcing-handler side-effect absence.
- Green: Implement the minimum Axon model, provider-effect handler/ledger, webhook command boundary, projection, and event mappings; remove synchronous `WordPressOrderPaymentAdapter` use from the payment path.
- Refactor: Retain verified SDK/authentication behavior, move SDK DTO mapping outward, and remove nested commands/integration events from the domain after equivalent tests pass.
- Validation: `./gradlew :apps:payment-federation:test --tests '*payment*' --tests '*MercadoPago*'`; full Java tests, coverage, build, lint, onp-spec verify, and non-CI audit.
- Acceptance: AC-283 passes with final-state assertions, provider calls remain at most once under redelivery, Payment reacts to no Inventory-rejection event, and no Payment code invokes another context or WordPress order mutation.
- Risks/blockers: Q-026 classifies payment tokens as sensitive and Q-024 fixes the terminal compensation as `REFUNDED`; Mercado Pago network is simulated deterministically in automated tests.
- Rollback: Preserve the existing Payment API and old listener behind mutually exclusive routing/profile flags; revert to the legacy writer before accepting target V1 bindings.

## T-248 — Migrate checkout and Transaction decisions [concluida]
- Refs: US-132, US-134, AC-281, AC-282, AC-285, AC-286, AC-293, AC-292
- Arquivos: apps/order-workflow-subgraph/src/checkout, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction, apps/payment-federation/src/main/resources/db/migration/transaction, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction, test/migrate-order-workflow-to-axon-java-transaction.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Dependencies: T-244, T-245.
- Objective: Port checkout idempotency and WooCommerce reconciliation into the Transaction context and create its event-sourced lifecycle without porting `OrderSaga`.
- Bounded context: Transaction.
- Use case: Start or resume checkout, create/reconcile at most one WooCommerce order, record independently received outcome facts, and emit `transaction.order-received.v1`.
- Aggregate: `Transaction`; `CheckoutOperation` is a Transaction-owned durable idempotency/lease consistency boundary, not a cross-context workflow aggregate.
- Invariants: Operation key binds one owner and semantic command; identical retry returns one transaction/order; conflicting subject/command fails deterministically; lease wait is bounded; ambiguous Woo response reconciles before retry; provider credentials do not enter Transaction events/outbox; local status/version never regresses; Transaction never commands Inventory or Payment.
- Consistency boundary: One Transaction stream and one checkout-operation row committed with its source/outbox mapping; Woo order creation is an idempotent external effect reconciled by the preserved operation reference.
- Affected ports: `WooCommerceOrderPort` ACL, checkout operation repository, Transaction projection repository, inbox/outbox, command/query gateways, clock/IDs.
- Behavior: Current deterministic command hash/reference fixtures remain compatible; accepted checkout creates one Transaction and publishes `OrderReceived`; received context results become local commands/facts only; no central next-step selection exists.
- Red: Port characterization fixtures and add `@spec:AC-281`, `@spec:AC-282`, `@spec:AC-285`, and structural `@spec:AC-286` tests for concurrency, conflict, expired lease, ambiguous response, bounded timeout, replay, stale outcome, and absence of orchestrator logic.
- Green: Implement the minimum Transaction model, checkout application boundary, Java Woo ACL, durable operation lease/reconciliation, projection inputs, and event mapping; do not modify the Node writer or routing yet.
- Refactor: Delete duplicated Java/Node-independent mapping helpers only after fixture parity; keep the external reconciliation plugin and operation-reference semantics.
- Validation: `./gradlew :apps:payment-federation:test --tests '*transaction*' --tests '*Checkout*' --tests '*WooCommerce*'`; full Java tests, coverage, build, lint, onp-spec verify, and non-CI audit.
- Acceptance: AC-285 concurrency/reconciliation tests prove one internal transaction and at most one Woo order; AC-286 structural test proves Transaction has no cross-context command; checkout compatibility fixtures match Node behavior.
- Risks/blockers: Q-022 selects an abort-on-data clean start; Q-026 fixes the 30-second lease, 24-hour abandonment cleanup, 30-day technical-record retention, credential redaction, and bounded retry policy; currency and Woo status mapping remain contract-controlled.
- Rollback: Java remains shadow/non-writing; discard target Transaction streams/projections and continue routing all checkout commands to Node.

## T-249 — Build replayable projections and compatible GraphQL [concluida]
- Refs: US-132, US-134, US-135, AC-281, AC-287, AC-288, AC-292
- Arquivos: libs/contracts/graphql/order-workflow/schema.graphql, apps/payment-federation/src/main/java/dev/desafio/transaction/*/application/query, apps/payment-federation/src/main/java/dev/desafio/transaction/*/infrastructure/persistence, apps/payment-federation/src/main/java/dev/desafio/transaction/*/interfaces/graphql, apps/payment-federation/src/main/resources/graphql, apps/payment-federation/src/test/java/dev/desafio/transaction/graphql, apps/payment-federation/src/test/java/dev/desafio/transaction/projection, test/migrate-order-workflow-to-axon-java.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Dependencies: T-246, T-247, T-248.
- Objective: Derive context-owned read models from Domain Events and serve compatible federated queries/mutations through Axon gateways without loading aggregates for display.
- Bounded context: Transaction, Inventory, and Payment independently; GraphQL composition is an outer interface boundary.
- Use case: Build/rebuild `TransactionView`, `CheckoutOperationView`, `InventoryReservationView`, and `PaymentView`; preserve `startCheckout`, `checkout`, `Order.workflow`, entity resolution, validation, OAuth scopes, and error codes.
- Aggregate: Existing context aggregates are event sources; projections have no aggregate and use idempotent version-guarded row updates.
- Invariants: Online and replay rebuilds produce identical rows; older event versions cannot overwrite newer views; query handlers are side-effect free; boundary DTOs do not expose persistence/domain objects; authorization preserves owner and scope isolation.
- Consistency boundary: One projection row per owned view identity and processor checkpoint according to the persistence proof from T-244.
- Affected ports: Projection repositories, CommandGateway/ReactorCommandGateway, QueryGateway/ReactorQueryGateway, OAuth principal/capability mapping, GraphQL DTO mappers.
- Behavior: Domain Events update views; query handlers read PostgreSQL views; GraphQL mutations dispatch commands; current contract remains compatible until an approved version change.
- Red: Add `@spec:AC-281`, `@spec:AC-287`, and `@spec:AC-288` projection replay/order and real GraphQL HTTP contract tests for data, errors, nullability, enums, IDs, validation, federation keys, scopes, and owner isolation.
- Green: Implement minimal projection handlers/repositories/query handlers and thin Spring GraphQL controllers using verified Axon 5 gateways; retain contract names and codes.
- Refactor: Consolidate row mapping only where repeated; remove direct JDBC/ORM reads from controllers/configuration and legacy projection writers after parity tests pass.
- Validation: `./gradlew :apps:payment-federation:test --tests '*Projection*' --tests '*GraphQL*'`; full Java tests, coverage, build, lint, gateway contract/typecheck tests, onp-spec verify, and non-CI audit.
- Acceptance: AC-287 online/replay comparison is byte-for-byte or field-for-field equivalent; AC-288 real endpoint tests preserve the approved schema/security contract; no query causes aggregate load or state change.
- Risks/blockers: Final terminal status names and legacy status mapping from Q-024 can block final projection fields; incompatible contract changes require separate approval.
- Rollback: Keep Gateway routing on Node and discard/rebuild shadow projections; no command writer changes in this phase.

## T-250 — Deliver transaction-filtered GraphQL SSE [concluida]
- Refs: US-135, AC-289, AC-288, AC-292
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/application/subscription, apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/interfaces/graphql, apps/payment-federation/src/main/resources/graphql, apps/payment-federation/src/test/java/dev/desafio/transaction/subscription, apps/gateway/src/subscriptions, apps/gateway/src/app.module.ts, apps/e2e/src, apps/wordpress-integration, test/migrate-order-workflow-to-axon-java.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Dependencies: T-249.
- Objective: Replace the custom Node PostgreSQL relay/broker path with the proven Axon subscription-query and Spring GraphQL SSE pattern while preserving the Gateway public edge.
- Bounded context: Transaction owns subscription semantics; Gateway/WordPress are outer delivery surfaces.
- Use case: Subscribe an authenticated owner to initial and subsequent updates for exactly one `transactionId`, reconnect, and cancel without leaking data/resources.
- Aggregate: None; the subscription reads `TransactionView` and consumes committed projection updates.
- Invariants: Updates emit only after projection commit; owner and transaction filters both match; versions are ordered/deduplicated; subscriber A never receives B; cancellation releases resources; no polling, manual SSE loop, or production `block()`.
- Consistency boundary: One subscription-query lifecycle over a durable Transaction projection; SSE transport has no business persistence.
- Affected ports: ReactorQueryGateway, QueryUpdateEmitter, Spring GraphQL subscription controller, Gateway downstream SSE client, OAuth authorization boundary.
- Behavior: `@SubscriptionMapping -> Flux` exposes initial result plus filtered updates over `Accept: text/event-stream`; Gateway forwards authentication/request identity and cancellation; two simultaneous subscribers remain isolated.
- Red: Add real HTTP SSE tests annotated `@spec:AC-289` and compatibility `@spec:AC-288`, using StepVerifier/Awaitility rather than sleeps; cover initial state, tx-A/tx-B filtering, simultaneous clients, ordered updates, reconnect, auth failure, and cancellation. Add the required WordPress/GraphiQL acceptance test or mark it `NOT VERIFIED` with an executable manual command only if Q-025 remains unresolved.
- Green: Implement the reference-aligned initial query handler, `subscriptionQuery`, `QueryUpdateEmitter`, controller `Flux`, and Gateway target change; use the existing Gateway proxy unless evidence requires a WordPress-hosted adapter.
- Refactor: Remove Node relay/broker only after end-to-end parity and cutover; do not introduce a second SSE framework or polling fallback.
- Validation: `./gradlew :apps:payment-federation:test --tests '*Subscription*' --tests '*Sse*'`; relevant Gateway tests and `npx nx run gateway:typecheck`; `npx nx run e2e:e2e`; full Java tests/build/lint, onp-spec verify, and non-CI audit.
- Acceptance: AC-289 proves the complete required Axon-to-SSE path and isolation through the public surface; AC-288 subscription compatibility remains green; any literal WordPress-hosted requirement is explicitly proven or blocks completion.
- Risks/blockers: Q-025 selects Gateway GraphiQL as the public surface; Federation must not be claimed to route subscriptions without protocol evidence.
- Rollback: Restore Gateway SSE downstream URL to Node; Java subscription remains unused and Node relay/broker remains deployable until final cutover.

## T-251 — Prove the complete choreographed lifecycle and compensations [concluida]
- Refs: US-133, US-134, AC-283, AC-284, AC-286, AC-287, AC-293, AC-292
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/transaction, apps/payment-federation/src/main/java/dev/desafio/transaction/inventory, apps/payment-federation/src/main/java/dev/desafio/transaction/payment, apps/payment-federation/src/test/java/dev/desafio/transaction/e2e, apps/payment-federation/src/test/java/dev/desafio/transaction/architecture, test/migrate-order-workflow-to-axon-java.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Dependencies: T-246, T-247, T-248, T-249, T-250.
- Objective: Connect only the approved RabbitMQ bindings and prove Inventory-first choreography, compensations, idempotency, ordering, concurrency, and causal observability end to end.
- Bounded context: Transaction, Inventory, and Payment remain separate participants.
- Use case: Complete, reject, cancel, release, and refund a transaction through independent `event received -> local decision -> event produced` reactions.
- Aggregate: `Transaction`, `InventoryReservation`, and `Payment`; there is no saga aggregate, coordinator, process manager, or workflow service.
- Invariants: Inventory reacts first to OrderReceived; Payment has no path before InventoryReserved; each handler issues commands only to its own context; Inventory and Transaction react independently to PaymentRejected; compensation is a new local operation; causal IDs persist; duplicates/out-of-order delivery converge without terminal-state regression.
- Consistency boundary: Three independent event streams and three local inbox/outbox transactions joined only by at-least-once Integration Events.
- Affected ports: All context AMQP inbound/outbound ports, Woo stock/order simulated adapters, PaymentProvider simulated adapter, projections, QueryUpdateEmitter, observability metadata/logging.
- Behavior: Happy path reaches completed and emits SSE; inventory rejection never invokes Payment; payment rejection releases Inventory and rejects Transaction; commit rejection after approval triggers the approved refund/compensation outcome; broker outage recovers from outbox; concurrent/duplicate/out-of-order messages converge.
- Red: Add `@spec:AC-286`, `@spec:AC-293`, and supporting `@spec:AC-283`, `@spec:AC-284`, `@spec:AC-287`, `@spec:AC-292` E2E/architecture tests using PostgreSQL and RabbitMQ Testcontainers. Cover happy path, each failure/compensation, N duplicates, temporary broker outage, last-stock concurrency, concurrent approvals/cancellation, stale projection events, metadata chain, and no hidden orchestrator.
- Green: Enable only the event bindings and local reaction handlers needed by the scenarios; use deterministic simulated external adapters; do not add a central sequencing component.
- Refactor: Remove obsolete direct cross-context calls and unused legacy Java routing only after every scenario is green; keep handlers local and explicit rather than introducing a generic choreography framework.
- Validation: `./gradlew :apps:payment-federation:test --tests '*E2E*' --tests '*Choreograph*' --tests '*Architecture*'`; full Java test/coverage/build/lint; relevant contract tests; onp-spec verify and non-CI audit.
- Acceptance: AC-286 proves strict choreography structurally and behaviorally; AC-293 proves every boundary crosses real RabbitMQ; all happy/failure paths and causal metadata are green with zero critical skips.
- Risks/blockers: Q-024 is resolved: post-approval inventory commit failure must trigger an idempotent refund and Payment must converge through `REFUND_PENDING` to `REFUNDED`; Amazon MQ behavior remains separately operationally validated.
- Rollback: Disable target event bindings and return the entire command path to legacy writers; replayable event/projection data remains for diagnosis but receives no commands.

## T-252 — Import or clean-start legacy state and perform reversible cutover [concluida]
- Refs: US-134, US-135, US-136, AC-285, AC-287, AC-288, AC-289, AC-290, AC-291, AC-292, AC-293
- Arquivos: apps/order-workflow-subgraph/src/persistence, apps/payment-federation/src/main/java/dev/desafio/transaction/migration, apps/payment-federation/src/main/resources/db/migration, apps/payment-federation/src/test/java/dev/desafio/transaction/migration, apps/gateway, compose.yaml, apps/e2e, test/migrate-order-workflow-to-axon-java.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Dependencies: T-251 and explicit resolution of Q-022, Q-024, Q-025, and applicable Q-026 policies.
- Objective: Choose and prove either a restartable side-effect-free legacy import or an approved clean-start gate, compare shadow reads, and switch GraphQL/SSE/AMQP ownership so exactly one runtime accepts commands.
- Bounded context: Transaction owns imported workflow/checkout state; Payment and Inventory own only their legacy rows; Gateway and deployment are technical cutover boundaries.
- Use case: Preserve or explicitly retire existing durable state, verify parity, cut over one writer, and roll back routing without duplicate WooCommerce, Mercado Pago, or stock effects.
- Aggregate: Existing context aggregates receive imported initialization/history only if the approved Axon persistence model supports a proven semantic import; otherwise no aggregate is created for clean start.
- Invariants: Import is restartable and checkpointed; it performs no external I/O or RabbitMQ publication; every legacy row has disposition; shadow mode is read-only; exactly one command writer and one event binding set is active; correlation/idempotency identities survive; rollback never merges divergent writes.
- Consistency boundary: One import batch/checkpoint transaction plus per-context stream/projection transactions; routing switch is an operational boundary guarded by quiescence/reconciliation.
- Affected ports: Legacy readers, import checkpoint, Axon event append/import boundary, projection rebuild, Gateway routing, RabbitMQ bindings, health/readiness.
- Behavior: Dry run inventories rows, import or clean-start proof completes, restart resumes safely, projections reconcile, Gateway GraphQL/SSE targets Java, old consumers become read-only/stopped, health checks and public E2E pass, and rollback restores the old route before any divergent write window.
- Red: Add `@spec:AC-290` and `@spec:AC-291` migration/cutover tests plus regression annotations for AC-285/287/288/289/293. Demonstrate failure on duplicate import, external side effect, incomplete row disposition, two active writers, broken Gateway/SSE routing, and rollback after the allowed boundary.
- Green: Implement only the approved importer or clean-start assertion, shadow comparator, mutually exclusive routing/bindings, readiness gates, and reversible deployment changes.
- Refactor: Remove temporary comparison code only after signed reconciliation evidence; retain immutable migration audit output and rollback runbook.
- Validation: importer dry-run and restart commands documented by the chosen implementation; full Java suite; `npx nx run gateway:typecheck`; relevant Gateway/contract tests; `npx nx run e2e:e2e`; `docker compose config`; `docker compose up --build` acceptance journey; coverage/build/lint/onp-spec verify and non-CI audit.
- Acceptance: AC-290 has executable proof for every legacy row or an approved zero-state gate; AC-291 proves sole Java command ownership, public GraphQL/SSE health, and a tested rollback checkpoint; no dual writer window exists.
- Risks/blockers: Q-022 approves clean start and requires the cutover to abort when any legacy durable row exists; production ingress/DNS/secrets/migration runner are absent and must be `NOT VERIFIED` with an owner and command; rollback after new Java-only writes requires forward recovery rather than unsafe traffic reversal.
- Rollback: Before the irreversible checkpoint, quiesce commands, restore old Gateway/queue routing, verify legacy writer health, and keep Java data read-only. After divergent Java writes, stop and execute the approved forward-recovery runbook; never blindly re-enable Node.

## T-253 — Retire Node Workflow and close all quality gates [pendente]
- Refs: US-136, AC-280, AC-282, AC-286, AC-288, AC-289, AC-290, AC-291, AC-292, AC-293
- Arquivos: apps/order-workflow-subgraph, apps/gateway, apps/payment-federation, apps/wordpress-integration, libs/contracts, infra/sst.config.ts, compose.yaml, README.md, docs, test, .spec/features, .spec/verification
- Modelo: gpt-5.6-sol
- Esforço: alto
- Approval: The user explicitly approved sequential execution with `gpt-5.6-sol` and high effort before this clean-context run; do not request that confirmation again.
- Continuation: Commit `d03780e4` completed the runtime cutover and `onp-spec verify migrate-order-workflow-to-axon-java` passed 14/14 acceptance criteria with 515 tests. Continue only with the remaining global `audit --ci` cleanup: replace historical task paths retired by this cutover with current evidence, restore missing legacy AC annotations on surviving tests, refresh obsolete verification evidence, and do not recreate the Node application.
- Dependencies: T-252, completed reconciliation window, approved irreversible checkpoint.
- Objective: Remove the inactive Node Order Workflow from source/deployment inventories, eliminate compatibility scaffolding that no longer has consumers, document operations, and obtain the final mechanical Definition of Done.
- Bounded context: Repository/deployment governance technical boundary; no business ownership moves in this phase.
- Use case: Make Java the only Transaction implementation and prove the repository, runtime, and documentation describe that state consistently.
- Aggregate: None; this phase removes obsolete artifacts and validates the deployed architecture.
- Invariants: No Node workflow process, route, queue consumer, database writer, central saga, PG notification relay, or in-memory SSE broker remains active; Gateway targets Java; contracts have known consumers; three business schemas remain isolated; no critical test is skipped; every AC has an annotated test and current runner evidence.
- Consistency boundary: One repository/deployment inventory and one final acceptance run; migrated business streams remain owned by their contexts.
- Affected ports: Gateway downstream configuration, deployment health, RabbitMQ topology cleanup, documentation/runbooks; no new domain port.
- Behavior: Node service and obsolete configuration are removed, orphan queues/contracts are deleted only after consumer inventory proves safety, Java/Gateway/WordPress acceptance remains green, and operational documentation covers replay, DLQ, outbox, migrations, backup/restore, observability, rollback, and incident ownership.
- Red: Add/update repository inventory and deployment tests annotated `@spec:AC-291` and final gate coverage `@spec:AC-292`; make them fail while Node Workflow remains active or any AC lacks executable proof.
- Green: Remove the retired service and stale wiring, update inventories/docs, and resolve all remaining `NOT VERIFIED` critical items or keep the feature open.
- Refactor: Delete compatibility bridges, old schemas/queues, and legacy contracts only when ownership/retention approval and restore evidence exist; avoid renaming the Java deployable unless separately justified.
- Validation: full repository unit/integration/contract/E2E commands; `npx nx run-many -t typecheck lint test build`; Java clean test and coverage; `docker compose config`; public GraphQL/SSE/WordPress acceptance; `node .agents/skills/onp-spec-driven/scripts/onp-spec.mjs verify migrate-order-workflow-to-axon-java`; `node .agents/skills/onp-spec-driven/scripts/onp-spec.mjs audit --ci`.
- Acceptance: Every checkbox in Section P is supported by current evidence; all AC-280 through AC-293 annotated tests pass; zero critical skips/failures; `onp-spec verify` and `audit --ci` exit 0; Java is the sole owner and Node is absent from active inventories.
- Risks/blockers: Destructive removal requires an approved backup/restore and retention checkpoint; any unresolved critical `NOT VERIFIED` item prevents task completion.
- Rollback: Restore deleted source/deployment artifacts from version control only before legacy data/topology retirement; after retention cleanup use the approved backup/restore or forward-recovery runbook, not ad hoc reversal.
