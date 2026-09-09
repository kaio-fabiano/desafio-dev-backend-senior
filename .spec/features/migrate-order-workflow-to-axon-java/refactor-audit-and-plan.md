# Java/Axon 5 Refactor Audit and Plan

> Feature: `migrate-order-workflow-to-axon-java`
>
> Phase status: audit and planning only; no production implementation
>
> Evidence date: 2026-09-09

## A. Executive Summary

The current platform has a Node Order Workflow service and a Java Payment
Federation service containing Payment and Inventory. The Node `OrderSaga`
centrally advances a payment-first state machine, while Java performs payment
provider work before durable inbox ownership and calls WordPress synchronously
after authorization. Axon is not present in the Java runtime.

The target is one Java 21/Spring Boot modular monolith with Transaction,
Inventory, and Payment bounded contexts. Axon Framework 5.3.1 owns internal
commands, event-sourced decisions, projections, queries, and subscription
queries. Spring AMQP/RabbitMQ carries versioned Integration Events between
contexts. The lifecycle is Inventory-first and strictly choreographed; no
component knows or advances the complete sequence.

The principal blockers are the unselected Axon 5 persistent store, the literal
meaning of the required WordPress/GraphiQL subscription surface, legacy-data
migration policy, terminal compensation policy, and operational/security
parameters. These are not implementation details and remain **NEEDS
VALIDATION**.

Detailed evidence is retained in [the Java audit](audit-current-java.md) and
[the Workflow audit](audit-current-workflow.md).

## B. Effective Versions Found

| Component | Current project | Local reference | Evidence |
|---|---:|---:|---|
| Java | 21 | 21 | Java audit, Effective versions |
| Spring Boot | 3.5.6 | 3.5.16 | Gradle build/JAR; reference POM |
| Spring Framework | 6.2.11 | managed, unresolved | packaged JAR; **NEEDS VALIDATION** for reference |
| Axon Framework | absent | 5.3.1 | current build/JAR; reference BOM |
| Axon Reactor | absent | 5.3.1 | current build; reference POM |
| Axon AMQP | absent | absent | both builds |
| Spring GraphQL | 1.4.2 | Boot-managed | packaged JAR; reference resolution **NEEDS VALIDATION** |
| Reactor Core | 3.7.11 transitive | Boot/Axon-managed | packaged JAR; reference resolution **NEEDS VALIDATION** |
| Spring AMQP / Rabbit client | 3.2.7 / 5.25.0 | absent | packaged JARs |
| PostgreSQL driver | 42.7.7 | absent | packaged JAR |
| Flyway | 11.7.2 | absent | packaged JAR |
| RabbitMQ server | 4.1.3 | absent | `compose.yaml` |
| Testcontainers | absent in Java | absent | build descriptors |
| Apollo federation support | 5.5.0 | absent | Gradle build |
| Mercado Pago SDK | 3.3.1 | absent | Gradle build |

No version is estimated. Unresolved reference dependencies require a JDK 21
`mvn dependency:tree` run.

## C. Current Project Map

| Runtime/boundary | Current responsibility | Target action |
|---|---|---|
| NestJS Gateway | OAuth-aware Federation composition and public SSE proxy | **KEEP**, retarget Java endpoints |
| NestJS Identity | Better Auth OAuth issuer, sessions, identity subgraph | **KEEP** |
| Node Order Workflow | checkout, Woo order ACL, central saga, inbox/outbox, GraphQL/SSE | **SPLIT/MOVE/REMOVE** |
| Java Payment context | domain rules, provider, webhook, AMQP, JDBC, GraphQL | **REFACTOR** to Axon 5 and isolated schema |
| Java Inventory context | Woo stock effects, AMQP, JDBC claim/inbox/outbox | **REFACTOR** to independent Axon participant |
| WordPress/WooCommerce | authoritative catalog, cart, order, stock and native subgraph | **KEEP** as external system of record |
| RabbitMQ | integration transport, retries and DLQ | **KEEP/REFACTOR** topology and contracts |
| PostgreSQL databases | separate current Identity, Workflow and Payment databases | **MIGRATE** business data to isolated schemas in one target instance |
| MariaDB | WordPress/WooCommerce storage | **KEEP** outside Java ownership |

The exhaustive file/package classifications are in both audit reports.

## D. Violations Found

| Severity | Evidence | Violation | Correction |
|---|---|---|---|
| Critical | `apps/order-workflow-subgraph/src/saga/order-saga.ts:72-208` | Central orchestrator owns the whole lifecycle | Remove; use independent context reactions |
| Critical | `outbox.repository.ts:35-40`, `order-saga.ts:76-93` | Payment-first flow conflicts with approved Inventory-first choreography | Introduce OrderReceived; Payment reacts only to InventoryReserved |
| Critical | `PaymentHandler.java:24-31` | Provider effect precedes durable inbox claim | Establish durable local intent/effect protocol before provider I/O |
| Critical | `AuthorizePaymentHandler.java:23-29` | Payment synchronously mutates WordPress order | Publish Payment result; Transaction reacts locally |
| Critical | Java build/package inventory | Axon 5 CQRS/Event Sourcing is absent | Introduce only proven Axon 5.3.1 APIs |
| Critical | Java and Node migrations | Context schemas are absent/unqualified | Create isolated schema-owned migration streams |
| High | Java listeners and Node event types | Domain and Integration Events are conflated | Add application mapping and versioned contracts |
| High | current event envelope | `correlationId`, `causationId`, `aggregateId`, `transactionId` absent | Version envelope and contract-test metadata |
| High | Java outbox/listener flow | No independently recoverable outbox relay | Add relay, confirm state, retry and outage recovery |
| High | Node PG relay/in-memory broker | SSE bypasses required Axon subscription-query flow | Replace with projection + QueryUpdateEmitter + subscription query |
| High | WordPress SDL | WordPress exposes no Subscription type | Resolve public-surface requirement before claiming acceptance |
| High | Java tests | H2/mocks substitute for required PostgreSQL/RabbitMQ integration | Add real Testcontainers coverage |
| Medium | current inbox/outbox/retry implementations | Consumer identity and causal/DLQ metadata are incomplete | Use `(consumer,eventId)` and preserve original envelope |

## E. Comparison with `axon-graphql-posts`

| Proven reference pattern | Current equivalent | Difference | Target action |
|---|---|---|---|
| `@EventSourced` entity and `@EventSourcingHandler` | mutable JDBC records/manual state | No event reconstruction | Adapt Axon 5 entity model per context |
| `@CommandHandler`, `@InjectEntity`, `EventAppender` | handwritten handlers | No Axon dispatch | Adapt verified handler pattern |
| `@EventHandler` projection/update | repository mutation after business call | Side effects and state are coupled | Separate projection and external-effect handlers |
| `@QueryHandler` and QueryGateway | direct JDBC/ORM query | Read path is hand wired | Introduce dedicated views/query handlers |
| `QueryUpdateEmitter` + subscription query | PG LISTEN/NOTIFY + in-memory broker | Custom realtime mechanism | Adapt reference flow with owner/transaction filter |
| `@SubscriptionMapping -> Flux` | Node `graphql-sse` AsyncIterable | Different endpoint runtime | Port contract to Spring GraphQL SSE |
| In-memory Axon stores | no Axon | Reference is non-durable | Do not copy; select proven PostgreSQL persistence |
| SQLite auto-DDL | Flyway/PostgreSQL and Node MikroORM | Reference violates target migration policy | Keep versioned PostgreSQL migrations |
| No AMQP/OAuth/external providers | existing project adapters | Reference proves none of these | Retain project-specific outer adapters |

## F. Proposed Bounded Context Map

```text
Identity -- OAuth/JWKS --> Gateway -- GraphQL/SSE --> Java application

Transaction -- OrderReceivedV1 ----------> RabbitMQ --> Inventory
Transaction <-- InventoryReservedV1 ------ RabbitMQ <-- Inventory
Payment     <-- InventoryReservedV1 ------ RabbitMQ <-- Inventory
Transaction <-- PaymentApprovedV1 -------- RabbitMQ <-- Payment
Inventory   <-- PaymentApprovedV1 -------- RabbitMQ <-- Payment
Transaction <-- InventoryCommittedV1 ----- RabbitMQ <-- Inventory

Transaction --> WooCommerce order ACL
Inventory   --> WooCommerce stock port
Payment     --> Mercado Pago port
```

Contexts share neither domain classes, services, repositories, tables nor JPA
relations. Opaque identifiers and versioned Integration Events are their only
collaboration contracts.

## G. Event Catalog

All Integration Events use envelope fields `eventId`, `eventType`, `version`,
`aggregateId`, `transactionId`, `correlationId`, `causationId`, `occurredAt`,
and typed `payload`.

| Domain Event | Integration Event V1 | Producer | Consumers | Ordering/idempotency |
|---|---|---|---|---|
| `TransactionCreated` | `transaction.order-received.v1` | Transaction | Inventory | transaction stream; inbox `(consumer,eventId)` |
| `InventoryReserved` | `inventory.reserved.v1` | Inventory | Payment, Transaction | reservation/transaction sequence; unique reservation |
| `InventoryReservationRejected` | `inventory.reservation-rejected.v1` | Inventory | Transaction | same |
| `PaymentRequested` | none | Payment | local effect handler | Payment stream only |
| `PaymentPending` | `payment.pending.v1` | Payment | Transaction | payment sequence; provider idempotency key |
| `PaymentApproved` | `payment.approved.v1` | Payment | Inventory, Transaction | payment sequence; inbox deduplication |
| `PaymentRejected` | `payment.rejected.v1` | Payment | Inventory, Transaction | same |
| `PaymentRefunded` | `payment.refunded.v1` | Payment | Transaction | refund/payment sequence |
| `InventoryCommitted` | `inventory.committed.v1` | Inventory | Transaction | reservation sequence |
| `InventoryCommitRejected` | `inventory.commit-rejected.v1` | Inventory | Payment, Transaction | reservation sequence |
| `InventoryReleased` | `inventory.released.v1` | Inventory | Transaction | reservation sequence |
| `TransactionCompleted` | `transaction.completed.v1` | Transaction | external observers if required | transaction sequence |
| `TransactionRejected` | `transaction.rejected.v1` | Transaction | external observers if required | transaction sequence |
| `TransactionCancelled` | `transaction.cancelled.v1` | Transaction | Inventory, Payment | transaction sequence; local validity checks |

Final terminal names and post-approval failure semantics are **NEEDS
VALIDATION**. Domain Events are never serialized as public AMQP contracts.

## H. Command Catalog

| Context | Commands owned locally |
|---|---|
| Transaction | `StartCheckout`, `RecordInventoryReserved`, `RecordInventoryRejected`, `RecordPaymentPending`, `RecordPaymentApproved`, `RecordPaymentRejected`, `RecordInventoryCommitted`, `RecordInventoryReleased`, `CompleteTransaction`, `RejectTransaction`, `CancelTransaction` |
| Inventory | `ReserveInventory`, `CommitInventory`, `ReleaseInventory` |
| Payment | `RequestPayment`, `RecordProviderPending`, `ApprovePayment`, `RejectPayment`, `RefundPayment`, `HandleProviderNotification` |

AMQP listeners translate one validated Integration Event into one receiving
context command. No handler issues another context's command.

## I. Proposed RabbitMQ Topology

| Artifact | Proposal |
|---|---|
| Event exchange | `marketplace.events.v1`, durable topic |
| Retry exchange | `marketplace.retry.v1`, durable direct |
| Transaction queue | `transaction.events.v1`, quorum, Transaction-owned bindings |
| Inventory queue | `inventory.events.v1`, quorum, Inventory-owned bindings |
| Payment queue | `payment.events.v1`, quorum, Payment-owned bindings |
| Retry queues | `<consumer>.retry.1..3`, TTL 1 s/10 s/60 s, DLX back to event exchange |
| DLQs | `<consumer>.dlq.v1`, original body/headers plus failure metadata |
| Publisher guarantees | persistent, mandatory routing, publisher confirm |
| Consumer guarantees | manual ACK after durable local success; bounded retry for technical failures |

Business rejection is ACKed and expressed as a result event. Crash after
publisher confirm may duplicate delivery; inbox idempotency handles it.
Amazon MQ quorum-queue/TLS/permissions support remains **NEEDS VALIDATION**.

## J. CQRS and Projection Map

| View | Owner | Inputs | External use |
|---|---|---|---|
| `CheckoutOperationView` | Transaction | checkout claim/reconcile events | idempotency and recovery |
| `TransactionView` | Transaction | Transaction events and received local outcome commands | GraphQL workflow/query/subscription |
| `InventoryReservationView` | Inventory | reservation/commit/release events | operational query |
| `PaymentView` | Payment | request/provider/refund events | current federated Payment API |

Online processing and replay must produce identical projections. Older event
versions cannot overwrite newer rows. Queries never load aggregates for
display.

## K. SSE Flow

```text
Client or Gateway GraphiQL
  -> Gateway /graphql/stream (OAuth and public SSE termination)
  -> Java Spring GraphQL endpoint (resource server and orders:read)
  -> @SubscriptionMapping(transactionId)
  -> ReactorQueryGateway.subscriptionQuery(...)
  -> initial @QueryHandler result
  -> filtered QueryUpdateEmitter updates after projection commit
  -> Flux -> SSE -> Gateway -> client
```

The authenticated owner receives only the requested transaction. Reconnect,
initial state/version suppression, simultaneous subscribers, cancellation and
resource cleanup require executable tests. WordPress remains a composed data
owner and does not automatically proxy subscriptions. A literal
WordPress-hosted GraphiQL/SSE route is **NEEDS VALIDATION**.

## L. Saga Choreography

```text
Transaction accepts checkout and emits OrderReceivedV1
Inventory independently reserves and emits ReservedV1 or RejectedV1
Payment binds only ReservedV1 and emits Pending/Approved/RejectedV1
Inventory binds ApprovedV1 and emits CommittedV1 or CommitRejectedV1
Transaction independently records all facts and completes its own state
```

On reservation rejection Payment is never invoked. On payment rejection,
Inventory releases and Transaction rejects independently. On commit rejection
after approval, Payment refunds and Transaction enters compensation; final
terminal policy requires product approval. There is no coordinator, process
manager, Axon Saga, distributed rollback, or direct context call.

## M. Phased Implementation Plan

Execution is sequential by gate, although T-246, T-247, and T-248 may be
implemented in parallel after T-245 because their files and consistency
boundaries are independent. A later phase never starts until the preceding
required gate is green. Every behavior-changing task records a focused Red
failure, the minimum Green implementation, and a full-suite-green Refactor
result.

Every task runs in a new clean Codex context and a separate `codex exec`
invocation. Sequential execution controls ordering only; it never reuses chat
history. Parallel execution assigns exactly one task to each independent
session. The only context transferred between tasks is committed repository
state, specifications, verification evidence, and the execution ledger.

### Phase 1 — Axon persistence and architecture baseline (T-244)

- **Objective:** prove, rather than assume, the Axon 5.3.1 PostgreSQL event and
  processor persistence model and establish enforceable package/schema rules.
- **Files/areas:** Java Gradle build, application configuration, Flyway
  migrations, `dev.desafio.transaction` packages, architecture tests, Axon and
  PostgreSQL integration tests.
- **Dependencies:** approved audit/plan only. This phase blocks all domain work.
- **Changes:** pin Axon 5.3.1 without Axon 4; select the supported persistent
  event/token/processor implementation; record exact tables, schema and
  transaction manager; add `transaction`, `inventory`, and `payment` migration
  ownership; replace H2 persistence claims with PostgreSQL Testcontainers; add
  ArchUnit boundaries. A disposable persistence fixture is allowed only to
  prove infrastructure and is not a shared business aggregate.
- **Tests:** Red demonstrates absent Axon/durability/schema isolation; Green
  proves append, restart reconstruction, processor resume, concurrency, clean
  migration and forbidden imports/cross-schema access; Refactor keeps the 35
  characterized Java tests and new suite green.
- **Validation:** Java clean test and coverage, Nx Java build/lint, dependency
  graph inspection, focused restart/concurrency tests run twice with fresh
  containers, `onp-spec verify`, then non-CI audit.
- **Gate:** annotated AC-280 and AC-282 tests pass; no Axon 4 resolves; every
  persistence capability has executable evidence or an explicit blocking
  `NOT VERIFIED` result.
- **Risks/blockers:** Q-019 is a hard blocker. The reference's in-memory stores
  and SQLite are not acceptable substitutes.
- **Rollback:** revert the isolated dependencies/configuration/migrations before
  any business event stream exists; keep the persistence evidence.

### Phase 2 — Versioned contracts and AMQP reliability (T-245)

- **Objective:** establish one minimal, reusable Spring AMQP delivery mechanism
  with context-owned inbox/outbox boundaries before connecting business flows.
- **Files/areas:** `libs/contracts/events`, Java integration-contract package,
  per-context messaging/persistence adapters, topology configuration,
  migrations and RabbitMQ/PostgreSQL integration tests.
- **Dependencies:** Phase 1 green.
- **Changes:** define the causal V1 envelope; declare event/retry exchanges,
  context queues, 1/10/60-second retries and per-consumer DLQs; implement
  confirmed mandatory publishing, manual ACK, durable inbox/outbox and broker
  recovery. Use Spring AMQP already present; never add `axon-amqp`.
- **Tests:** Red covers missing fields, no relay, duplicate effects and lossy
  DLQ; Green exercises producer-to-consumer routing, serialization, outage,
  redelivery, retry and DLQ using real containers; Refactor shares only proven
  repeated mechanics while bindings remain context-specific.
- **Validation:** focused contract/Rabbit/inbox/outbox tests, complete Java
  suite, build/lint, verify and non-CI audit.
- **Gate:** AC-293 is green over real PostgreSQL and RabbitMQ; ACK follows
  durable handling, duplicates are harmless, and original causal metadata is
  replayable from DLQ.
- **Risks/blockers:** Amazon MQ operational features and payment credential
  classification remain blocked/`NOT VERIFIED`; neither may be invented.
- **Rollback:** disable new queues/listeners and retain existing V1 routing;
  no business writer has moved.

### Phase 3 — Independent Inventory participant (T-246)

- **Objective:** implement Inventory reserve/commit/release decisions in an
  event-sourced `InventoryReservation` without knowledge of Payment or
  Transaction internals.
- **Files/areas:** Java Inventory domain/application/infrastructure/interfaces,
  Inventory migrations and tests.
- **Dependencies:** Phases 1–2 green.
- **Changes:** introduce commands, Domain Events, sourcing and application
  handlers, projection and integration mappers; retain Woo stock behavior
  behind `StockPort` with durable reconciliation.
- **Tests:** pure domain and Axon fixture Red/Green/Refactor for available and
  unavailable stock, duplicate reserve, nonexistent release, commit/release,
  replay/no replay side effects, stale delivery and last-unit concurrency;
  PostgreSQL integration proves effect recovery.
- **Validation:** focused Inventory tests, full Java tests/coverage/build/lint,
  verify and non-CI audit.
- **Gate:** AC-281, AC-282 and AC-284 Inventory proofs are green; one reservation
  wins the last unit; emitted contracts are Inventory-owned.
- **Risks/blockers:** ambiguous Woo effects and multi-replica ordering require
  tests; JVM synchronization is not a distributed consistency strategy.
- **Rollback:** route exactly one writer back to the legacy Inventory consumer;
  leave target views unused.

### Phase 4 — Independent Payment participant (T-247)

- **Objective:** implement Payment event sourcing and a durable provider-effect
  protocol, with Payment beginning only after `InventoryReserved` in the target
  path.
- **Files/areas:** Java Payment domain/application/infrastructure/interfaces,
  Payment migrations and tests.
- **Dependencies:** Phases 1–2 green; may run in parallel with Phase 3, but both
  gates must pass before Phase 6.
- **Changes:** move commands/integration shapes out of the domain; record a local
  payment request before provider I/O; return provider/webhook outcomes through
  local commands; retain Mercado Pago behind `PaymentProvider`; remove the
  synchronous WordPress order mutation.
- **Tests:** card, Pix, pending, approval, rejection, valid/invalid refund,
  duplicate/conflicting intent, deterministic idempotency key, timeout after
  provider success, duplicate webhook, replay and no replay side effects.
- **Validation:** focused Payment/Mercado Pago tests, full Java tests/coverage,
  build/lint, verify and non-CI audit.
- **Gate:** AC-281, AC-282 and AC-283 are green; provider effects occur at most
  once and Payment calls no foreign context or WordPress order writer.
- **Risks/blockers:** Q-026 blocks production credential handling; Q-024 blocks
  final post-approval refund semantics.
- **Rollback:** retain old API/listener behind a mutually exclusive route and
  restore it before target bindings accept commands.

### Phase 5 — Checkout and Transaction decisions (T-248)

- **Objective:** move checkout idempotency and Woo order reconciliation to an
  event-sourced Transaction context without porting the central `OrderSaga`.
- **Files/areas:** Node checkout characterization sources, Java Transaction
  packages, Transaction migrations and tests.
- **Dependencies:** Phases 1–2 green.
- **Changes:** create `Transaction`, bounded `CheckoutOperation`, Java
  WooCommerce ACL, outcome-recording commands, and the
  `transaction.order-received.v1` mapper. Preserve command-hash and operation
  reference fixtures; make waiting bounded; exclude provider credentials.
- **Tests:** same/concurrent retry, conflict, expired lease, ambiguous response,
  bounded timeout, at-most-one Woo order, replay, stale outcomes and structural
  absence of cross-context commands/orchestration.
- **Validation:** focused Transaction/Checkout/Woo tests, full Java
  tests/coverage/build/lint, verify and non-CI audit.
- **Gate:** AC-285 passes and the Transaction portion of AC-286 proves it emits
  facts but never advances another context.
- **Risks/blockers:** Q-022 and Q-026 control legacy data, lease/retention,
  credentials, currency and Woo status behavior.
- **Rollback:** Java stays a non-writing shadow and Gateway remains on Node.

### Phase 6 — Replayable CQRS and compatible GraphQL (T-249)

- **Objective:** derive owned read models from events and preserve the current
  federated GraphQL query/mutation contract through thin Axon gateway adapters.
- **Files/areas:** shared Order Workflow SDL, Java query/projection/GraphQL
  packages and GraphQL/projection tests.
- **Dependencies:** Phases 3–5 green.
- **Changes:** implement `TransactionView`, `CheckoutOperationView`,
  `InventoryReservationView`, and `PaymentView`; add query handlers; move SQL
  out of configuration; dispatch mutations as commands; preserve OAuth,
  federation, fields, nullability and error codes.
- **Tests:** online versus replay projection equality, stale version rejection,
  side-effect-free queries and real GraphQL HTTP contract/security tests.
- **Validation:** focused projection/GraphQL tests, complete Java and relevant
  Gateway contract suites, coverage/build/lint, verify and non-CI audit.
- **Gate:** AC-281, AC-287 and AC-288 pass; queries never load aggregates for
  display and shadow view output is compatible.
- **Risks/blockers:** Q-024 terminal-state mapping may block final fields; a
  contract break requires separate approval.
- **Rollback:** Gateway stays on Node; target projections can be discarded and
  rebuilt.

### Phase 7 — Axon subscription query and public SSE (T-250)

- **Objective:** replace the custom Node relay/broker with the reference-proven
  `QueryUpdateEmitter -> subscriptionQuery -> @SubscriptionMapping -> Flux`
  flow, keeping Gateway as the evidenced public edge.
- **Files/areas:** Java Transaction subscription and GraphQL packages, Gateway
  SSE client/route, E2E tests and the approved WordPress/GraphiQL surface.
- **Dependencies:** Phase 6 green.
- **Changes:** add the initial query handler, owner/transaction-filtered updates,
  real Spring GraphQL SSE, Gateway target/configuration and cancellation flow.
  Do not add polling, a manual SSE framework, or claim Federation routing.
- **Tests:** real `text/event-stream` initial/update flow, tx-A/tx-B isolation,
  two subscribers, ordered reconnect, authorization and cancellation using
  StepVerifier/Awaitility; exercise the approved WordPress/GraphiQL path.
- **Validation:** focused subscription/SSE tests, Gateway typecheck/tests, E2E,
  full Java build/lint/test, verify and non-CI audit.
- **Gate:** AC-289 and subscription compatibility under AC-288 pass through the
  public edge. A literal WordPress-hosted requirement is either proven or
  remains a hard blocker.
- **Risks/blockers:** Q-025 must be resolved before the acceptance claim.
- **Rollback:** restore Gateway's downstream SSE URL to Node; retain the Node
  relay/broker until cutover.

### Phase 8 — Full choreography and compensation (T-251)

- **Objective:** connect only the approved RabbitMQ bindings and prove the whole
  Inventory-first lifecycle under success, failure, duplication, outage,
  ordering and concurrency.
- **Files/areas:** all three Java contexts, AMQP configuration, architecture and
  E2E tests.
- **Dependencies:** Phases 3–7 green.
- **Changes:** enable local reaction handlers only: Transaction emits order
  received; Inventory reserves; Payment reacts only to reserved; Inventory
  commits/releases; Transaction records its own facts. Add causal observability
  and the approved refund compensation, never a coordinator.
- **Tests:** real-container happy path through SSE; inventory rejection with no
  Payment call; payment rejection with independent release/rejection; commit
  failure/refund; broker outage; N duplicates; last-unit/concurrent approval,
  cancellation and stale ordering; metadata chain; no-hidden-orchestrator rule.
- **Validation:** focused E2E/choreography/architecture suite, full Java
  test/coverage/build/lint, contracts, verify and non-CI audit.
- **Gate:** AC-283, AC-284, AC-286, AC-287 and AC-293 are green with no critical
  skip; every cross-context hop was observed over real RabbitMQ.
- **Risks/blockers:** Q-024 is a hard blocker for the commit-failure scenario;
  Amazon MQ remains an operational validation outside container proof.
- **Rollback:** disable all target bindings together and return command traffic
  to legacy writers; keep event/projection data read-only.

### Phase 9 — Legacy state and reversible cutover (T-252)

- **Objective:** prove an approved import or clean start, compare shadow reads,
  then transfer GraphQL/SSE/AMQP ownership with exactly one command writer.
- **Files/areas:** legacy persistence, Java migration/import area and tests,
  Gateway, Compose and E2E.
- **Dependencies:** Phase 8 green and resolutions for Q-022, Q-024, Q-025 and
  applicable Q-026 decisions.
- **Changes:** implement only the approved restartable side-effect-free importer
  or clean-start gate; add checkpoints, dry-run and shadow comparison; quiesce,
  reconcile and atomically change routes/bindings; update readiness.
- **Tests:** every legacy row disposition, restart/duplicate import, zero
  external effects, projection parity, dual-writer rejection, public GraphQL/SSE
  and pre-checkpoint rollback.
- **Validation:** migration dry-run/restart, full Java/Gateway/E2E suites,
  Compose config/up acceptance, coverage/build/lint, verify and non-CI audit.
- **Gate:** AC-290 and AC-291 pass; one runtime accepts Transaction commands,
  Java serves public contracts, and rollback is tested before the checkpoint.
- **Risks/blockers:** production ingress, secrets and migration runner require
  owned `NOT VERIFIED` records; traffic cannot be blindly rolled back after
  divergent Java writes.
- **Rollback:** before the checkpoint, quiesce and restore legacy routes; after
  it, execute the approved forward-recovery runbook.

### Phase 10 — Node retirement and final proof (T-253)

- **Objective:** remove the inactive Node Workflow and stale compatibility
  wiring only after the reconciliation/retention checkpoint, then close every
  mechanical quality gate.
- **Files/areas:** Node Workflow, Java, Gateway, WordPress, shared contracts,
  Compose, repository tests, README/docs and this feature specification.
- **Dependencies:** Phase 9 green, reconciliation window complete, destructive
  cleanup explicitly approved.
- **Changes:** remove Node deployment/source from active inventory, central saga,
  old relay/broker and orphan routing only after consumer proof; publish
  operations/runbooks for replay, outbox, DLQ, migrations, backup/restore,
  observability and recovery. A Java deployable rename remains optional/YAGNI.
- **Tests:** repository inventory initially fails while Node is active; final
  public GraphQL/SSE/WordPress and lifecycle regression proves removal did not
  alter behavior; every AC annotation is current and executable.
- **Validation:** all repository unit/integration/contract/E2E, coverage,
  typecheck, lint and build commands; Compose validation; final `onp-spec
  verify`; final `onp-spec audit --ci`.
- **Gate:** all Section P items pass, AC-280 through AC-293 have runner evidence,
  no critical test is skipped, Java is sole owner, and both final mechanical
  commands exit zero.
- **Risks/blockers:** no critical `NOT VERIFIED` item may remain; deletion waits
  for backup/restore and retention approval.
- **Rollback:** before legacy retention cleanup, restore versioned artifacts and
  the tested route; afterward use backup/restore or forward recovery only.

## N. Test Matrix

The executable requirement-to-test mapping is maintained in
[testing-matrix.md](testing-matrix.md). It maps every AC-280 through AC-293 to
named annotated tests, level, infrastructure, owning tasks and objective
success conditions. It also covers domain invariants, Axon restart/replay,
projection rebuild, contract versioning, inbox/outbox, retry/DLQ, Mercado Pago,
WooCommerce, real GraphQL/SSE, WordPress surface acceptance, choreography,
concurrency, observability, cutover and Node retirement.

The matrix enforces PostgreSQL and RabbitMQ Testcontainers, prohibits H2 and
mocked infrastructure substitutes, and requires deterministic time/IDs and
asynchronous probes. Each phase reports runner counts and stops on failure.
Coverage percentages supplement rather than replace explicit invariant and
failure-path tests.

## O. Blockers and NEEDS VALIDATION

1. Select and prove the Axon 5.3.1-compatible persistent Event Store,
   processor/token, sequencing, snapshot and dead-letter infrastructure.
2. Determine its schema, exact tables/migrations and transaction integration;
   a conceptual `axon` schema is not yet approved.
3. Decide importer versus proven clean start for legacy Workflow and Java JDBC
   state.
4. Approve terminal Transaction states and post-approval inventory-failure
   compensation/refund semantics.
5. Resolve whether acceptance requires WordPress-hosted GraphiQL or Gateway
   GraphiQL over the composed WordPress graph.
6. Approve operation-key retention, lease timeout, abandonment cleanup and
   payment-credential retry semantics.
7. Classify/redact payment credentials and forbid reusable provider tokens in
   general integration contracts.
8. Validate Amazon MQ topology, TLS, credentials, quorum support, permissions,
   HA, ordering and replica behavior.
9. Define production ingress, secret management, migration runner,
   observability backend and rollback routing.
10. Run the reference test/dependency tree with an explicit JDK 21.

## P. Definition of Done

The migration is done only when every checked item has current executable
evidence. `NOT VERIFIED` is honest status, not completion.

- [ ] T-244 through T-253 are completed in dependency order and each phase has
  recorded Red, Green and Refactor evidence plus command/test counts.
- [ ] Java 21, Spring Boot 3 and Axon Framework/Reactor 5.3.1 are resolved; no
  Axon 4 artifact or unverified Axon 4 pattern is present.
- [ ] AC-280 proves Transaction, Inventory and Payment layer/context isolation,
  the narrow Axon metadata allowlist, and absence of cross-schema access.
- [ ] AC-281 proves real command -> event-sourced decision -> Domain Event ->
  projection -> query paths; queries and subscriptions do not load aggregates
  for display.
- [ ] AC-282 proves PostgreSQL-backed event/processor durability, restart,
  replay, replica/concurrency behavior and side-effect-free sourcing handlers.
- [ ] The exact Axon event/token/processor/snapshot/dead-letter tables, schema,
  ownership, migrations and transaction model are documented from evidence.
- [ ] One PostgreSQL/RDS target has exclusively owned `transaction`,
  `inventory`, and `payment` schemas with reproducible migrations, no auto-DDL,
  joins, foreign keys, JPA relations or repository reads across contexts.
- [ ] AC-283 proves Payment card/Pix/pending/approved/rejected/refund invariants,
  deterministic provider idempotency, webhook deduplication and at-most-once
  provider effect behind `PaymentProvider`.
- [ ] AC-284 proves Inventory reserve/reject/commit/release invariants,
  idempotency, last-unit concurrency and out-of-order behavior behind its stock
  port.
- [ ] AC-285 proves checkout semantic idempotency, owner/conflict handling,
  bounded leases and at-most-one WooCommerce order under concurrency and
  ambiguous responses.
- [ ] AC-286 proves the Inventory-first lifecycle and every approved
  compensation structurally and end to end, with no saga coordinator, process
  manager, workflow aggregate, Axon Saga or multi-context handler.
- [ ] Domain Events are internal; every external V1 Integration Event uses the
  approved typed envelope and contains no domain, provider SDK, GraphQL,
  WooCommerce or reusable payment-credential type.
- [ ] AC-293 proves real RabbitMQ event/retry/DLQ topology, mandatory confirmed
  publishing, manual ACK after durable local handling, `(consumer,eventId)`
  inbox deduplication, recoverable outbox, bounded retry and intact causal
  metadata through replay.
- [ ] AC-287 proves every read model is identical after online processing and
  replay and cannot be regressed by an older event version.
- [ ] AC-288 proves the existing federated GraphQL fields, nullability, keys,
  authorization, validation and error codes through the real HTTP endpoint.
- [ ] AC-289 proves initial and live transaction-filtered updates through
  `QueryUpdateEmitter`, Axon subscription query, `@SubscriptionMapping` and
  `Flux` over real SSE, including owner isolation, reconnect and cancellation.
- [ ] The approved WordPress/GraphiQL public surface exercises that Java SSE
  flow; it is not inferred from Apollo Federation capabilities.
- [ ] Mercado Pago and WooCommerce remain outer adapters/ACLs; their DTOs do not
  leak inward, no HTTP response alone implies payment approval, and external
  mapping/authenticity/reconciliation cases are tested.
- [ ] AC-290 proves either a restartable side-effect-free import with complete
  row disposition or an explicitly approved clean-start gate; no legacy state
  is silently abandoned.
- [ ] AC-291 proves shadow parity, a sole Java command writer, Java Gateway
  GraphQL/SSE routing, health/readiness, a tested rollback checkpoint, and Node
  Workflow removal from active source/deployment inventories.
- [ ] Production Amazon RDS/Amazon MQ TLS, credentials, HA, backup/restore,
  topology permissions, migration runner, observability, DLQ replay and recovery
  procedures have executable evidence or block release.
- [ ] No Redis/cache/search engine, Axon Server, new deployable, generic handler
  framework, base aggregate, or speculative abstraction was added without a
  separately approved evidenced requirement.
- [ ] AC-292 proves unit, Axon fixture, architecture, PostgreSQL/RabbitMQ
  integration, contract, GraphQL/SSE/WordPress acceptance, E2E, concurrency,
  coverage, typecheck, lint and build gates pass with zero critical skip.
- [ ] Every AC-280 through AC-293 has a non-skipped `@spec:AC-xxx` test whose
  runner result is current; no assertion was weakened and no validation was
  fabricated.
- [ ] `onp-spec verify migrate-order-workflow-to-axon-java` exits zero.
- [ ] `onp-spec audit --ci` exits zero and its raw result is retained as the
  final release evidence.
