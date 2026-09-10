# Java/Axon 5 Migration Test Matrix

> Feature: `migrate-order-workflow-to-axon-java`
>
> Status: implementation plan; every row is pending until its named runner evidence exists

## Test policy

- Every acceptance test title contains its `@spec:AC-xxx` tag. A skipped or
  `todo` test is not evidence.
- JUnit 5 is the default. Use AssertJ when available and Mockito only at an
  external unit-test boundary. Spring Boot tests are reserved for real Spring
  wiring.
- PostgreSQL and RabbitMQ integration tests use Testcontainers. H2 cannot
  substitute for PostgreSQL, RabbitMQ cannot be mocked in integration tests,
  and Axon cannot be mocked when dispatch/replay is under test.
- Asynchronous tests use Awaitility, Reactor `StepVerifier`, or another
  deterministic probe. They do not use `Thread.sleep()`, real time, uncontrolled
  UUIDs, public internet, production WooCommerce, or production Mercado Pago.
- Each phase records the command, total, passed, failed, and skipped counts.
  Anything not executed is `NOT VERIFIED`, with its reason and exact command.
- Initial coverage gates are at least 90% lines for critical Domain/Application
  code and 80% for measurable Infrastructure code. Explicit invariant and
  choreography branch coverage remains mandatory even when percentages pass.

## Acceptance-criterion traceability

| Criterion | Planned executable proof | Level | Infrastructure | Owning tasks | Success condition |
|---|---|---|---|---|---|
| AC-280 | `ArchitectureBoundariesTest.shouldEnforceContextsLayersAndAxonMetadataAllowlist()` with `@spec:AC-280` | Architecture | ArchUnit/JVM | T-244, T-245, T-253 | Inward dependencies pass; cross-context internals, outer Domain imports, cross-schema access, and orchestrator shapes fail the fixture. |
| AC-281 | `AxonCommandQueryPathTest.shouldSeparateCommandEventProjectionAndQueryPaths()` with `@spec:AC-281` | Integration | Axon 5.3.1, PostgreSQL Testcontainer | T-246–T-249 | A real command appends an event, updates a projection, and a query reads the view without loading the aggregate. |
| AC-282 | `AxonPersistenceRestartTest.shouldRestoreStreamsAndProcessorPositionsAfterRestart()` and `AxonConcurrencyTest.shouldRejectConflictingStreamWrites()` with `@spec:AC-282` | Integration | Axon 5.3.1, PostgreSQL Testcontainer, two application contexts | T-244, T-246–T-248 | State and processor progress survive restart; replay is side-effect free; concurrent writers preserve the aggregate boundary. |
| AC-283 | `PaymentAggregateTest` plus `PaymentProviderEffectIntegrationTest.shouldApplyProviderEffectAtMostOnce()` with `@spec:AC-283` | Unit/Axon fixture/integration | Axon fixture, PostgreSQL Testcontainer, deterministic provider adapter | T-247, T-251 | Card/Pix/pending/approval/rejection/refund transitions are valid and provider effects/webhooks remain idempotent. |
| AC-284 | `InventoryReservationTest` plus `InventoryConcurrencyIntegrationTest.shouldAllowOneWinnerForLastUnit()` with `@spec:AC-284` | Unit/Axon fixture/integration | Axon fixture, PostgreSQL Testcontainer, deterministic stock adapter | T-246, T-251 | Reserve/commit/release decisions converge under duplicate, concurrent, and out-of-order delivery without foreign-context imports. |
| AC-285 | `CheckoutOperationIntegrationTest.shouldCreateOneTransactionAndAtMostOneWooOrder()` with `@spec:AC-285` | Integration/contract | PostgreSQL Testcontainer, deterministic WPGraphQL server | T-248, T-252 | Same owner/semantic command is idempotent; conflicts are deterministic; expired/ambiguous operations reconcile; wait is bounded. |
| AC-286 | `ChoreographedLifecycleE2ETest` and `NoHiddenOrchestratorTest` with `@spec:AC-286` | E2E/architecture | PostgreSQL and RabbitMQ Testcontainers, simulated providers | T-248, T-251, T-253 | Inventory is first, Payment starts only after reservation, each reaction owns one context, and all compensations occur without coordinator/process manager. |
| AC-287 | `TransactionProjectionReplayTest.shouldMatchOnlineProjectionAfterReplay()` with `@spec:AC-287` | Integration | Axon 5.3.1, PostgreSQL Testcontainer | T-249, T-251, T-252 | Online/rebuilt views match for status, references, Pix, owner, timestamps, and monotonic version; stale events cannot overwrite. |
| AC-288 | `OrderWorkflowGraphQlCompatibilityTest.shouldPreserveFederatedContractAndAuthorization()` with `@spec:AC-288` | Contract/integration | Real Spring GraphQL HTTP endpoint, OAuth test issuer/keys | T-249, T-250, T-252 | Existing operations, fields, nullability, federation keys, validation, scopes, owner rules, and error codes remain compatible. |
| AC-289 | `TransactionSubscriptionSseTest.shouldStreamOnlyOwnedTransactionAndReleaseOnCancel()` with `@spec:AC-289` | Integration/E2E | Spring GraphQL SSE, Axon subscription query, Gateway | T-250, T-252 | Initial plus committed updates reach only the matching owner/transaction in order; simultaneous clients isolate; cancel releases resources. |
| AC-290 | `LegacyStateMigrationTest.shouldImportExactlyOnceWithoutExternalEffects()` or `CleanStartGateTest.shouldProveNoRowsRequireMigration()` with `@spec:AC-290` | Migration/acceptance | Legacy and target PostgreSQL containers | T-252, T-253 | Exactly one approved branch is tested; every row has a disposition; restart is safe; no Woo, provider, or Rabbit side effect occurs. |
| AC-291 | `SingleWriterCutoverAcceptanceTest.shouldRouteGraphQlSseAndAmqpToJavaOnly()` with `@spec:AC-291` | Deployment/E2E | Compose, Gateway, Java, WordPress, PostgreSQL, RabbitMQ | T-252, T-253 | Java passes health/public journeys, only one command writer is active, rollback checkpoint is proven, and Node is absent from active inventory after retirement. |
| AC-292 | `MigrationQualityGateTest.shouldHaveExecutableEvidenceForEveryCriterion()` plus `test/migrate-order-workflow-to-axon-java.test.mjs`, with `@spec:AC-292`, and repository gates | Meta/acceptance | JUnit through a TAP evidence adapter plus all relevant runners | T-244–T-253 | Unit, fixture, architecture, integration, contract, E2E, coverage, typecheck, lint, verify, and final CI audit pass with no critical skip. |
| AC-293 | `RabbitMqBoundaryIntegrationTest.shouldPublishConsumeDeduplicateRetryAndDeadLetter()` with `@spec:AC-293` | Integration/E2E | RabbitMQ and PostgreSQL Testcontainers | T-245, T-246–T-248, T-251–T-253 | Real topology routes versioned envelopes; ACK follows durable handling; duplicates are harmless; outage recovers; causal metadata reaches DLQ intact. |

## Required behavioral and infrastructure coverage

| Area | Planned test/scenario | Level | Infrastructure | Criterion/task reference | Success condition |
|---|---|---|---|---|---|
| Axon API compatibility | Resolve dependency graph and compile tests using only reference-proven 5.3.1 annotations/gateways | Build/architecture | Gradle dependency resolution | AC-280/282, T-244 | No Axon 4 artifact or unproved legacy annotation is resolved. |
| Axon persistence | Restart, replay, processor resume, sequence conflict, snapshot/dead-letter capability inventory | Integration | PostgreSQL Testcontainer | AC-282, T-244 | Proven capabilities pass; unsupported capabilities remain explicit blockers, not assumptions. |
| Schema isolation | Migrate empty database and inspect schemas, tables, constraints, indexes, grants, FKs, SQL/JPA access | Migration/architecture | PostgreSQL Testcontainer | AC-280/282, T-244 | `transaction`, `inventory`, and `payment` ownership is exclusive; no cross-context relation exists; no production auto-DDL. |
| Domain replay safety | Reconstruct each aggregate and assert sourcing handlers call no provider, RabbitMQ, WooCommerce, or repository | Axon fixture | In-memory test fixtures only | AC-282–284, T-246–T-248 | Replayed state and version are correct with zero external effect. |
| Projection replay | Rebuild each view from a controlled event sequence and compare with online processing | Integration | Axon, PostgreSQL Testcontainer | AC-281/287, T-249 | Same rows/fields/version result; unrelated fields remain consistent. |
| Integration contracts | Serialize/deserialize every V1 event and validate required fields, enums, timestamp, IDs, version, compatibility fixtures | Contract | JSON schema/object mapper | AC-293, T-245 | Domain classes/provider DTOs do not appear; malformed or unknown versions fail predictably. |
| Inbox atomicity | New event, duplicate event, local failure before/after durable command outcome | Integration | Axon, PostgreSQL Testcontainer | AC-284/293, T-245–T-248 | `(consumer,eventId)` prevents a second business effect and ACK occurs only after durable completion. |
| Outbox recovery | Broker down leaves pending row; broker returns; confirmed publication marks it sent; crash-after-confirm may redeliver safely | Integration | PostgreSQL and RabbitMQ Testcontainers | AC-293, T-245 | No event loss or semantic mutation after retry; duplicate is absorbed downstream. |
| Retry/DLQ | Transient failures follow 1/10/60-second policy; poison reaches per-consumer DLQ; business rejection does not retry | Integration | RabbitMQ Testcontainer, controllable scheduling | AC-293, T-245 | Attempt limit, routing, original body, event/correlation/causation IDs, consumer and failure metadata are preserved. |
| Payment provider | Request mapping, amount/currency/reference, deterministic idempotency key, timeout, pending, approved, rejected, duplicate webhook, refund, reconciliation | Unit/integration | Stub HTTP server/deterministic adapter, PostgreSQL | AC-283, T-247 | Provider transport stays outside Domain/Application; HTTP success alone does not approve; effects are at most once. |
| WooCommerce ACL | Order/cart parsing, SKU/quantity/price/currency/status mapping, operation reference, duplicate/ambiguous response, authenticity where applicable | Contract/integration | Deterministic WPGraphQL server; real acceptance in Compose | AC-285/288, T-248/252 | External DTOs do not leak inward; retries produce at most one order; mapping is explicit. |
| GraphQL query/mutation | Real HTTP response data/errors/nullability/enums/IDs/input validation/federation/security | Contract/integration | Spring GraphQL endpoint, OAuth test material | AC-288, T-249 | Public compatibility contract passes without direct controller-only substitution. |
| GraphQL SSE | Real `Accept: text/event-stream`, tx-A/tx-B filtering, two clients, initial update, reconnect, cancel | Integration/E2E | Axon, Spring GraphQL, Gateway | AC-289, T-250 | Complete event-to-QueryUpdateEmitter-to-subscriptionQuery-to-Flux chain passes deterministically. |
| Gateway GraphiQL surface | Open Gateway GraphiQL over the composed WordPress graph, subscribe, drive same/other transaction changes | Acceptance | Compose WordPress/Gateway/Java/RabbitMQ/PostgreSQL | AC-289/291, T-250/252 | Gateway receives only matching immediate updates from Java; WordPress remains the commerce data owner and does not proxy subscriptions. |
| Choreography happy path | Woo order -> OrderReceived -> InventoryReserved -> PaymentApproved -> InventoryCommitted -> TransactionCompleted -> SSE | E2E | PostgreSQL/RabbitMQ Testcontainers, simulated external adapters | AC-286/287/293, T-251 | Final views and emitted events match; correlation chain is intact; no direct context call. |
| Inventory unavailable | OrderReceived -> rejection; Payment has no invocation; Transaction rejects | E2E | Same as above | AC-284/286, T-251 | No payment effect or payment event exists. |
| Payment rejected | Reserved -> PaymentRejected -> independent Inventory release and Transaction rejection | E2E | Same as above | AC-283/284/286, T-251 | Release and rejection occur once without distributed rollback. |
| Commit failure after approval | Approved -> commit rejection -> `REFUND_PENDING` -> `REFUNDED` | E2E | Same as above | AC-283/284/286, T-251 | The refund operation and terminal `REFUNDED` result occur idempotently, while duplicate or out-of-order events cannot regress Payment or Transaction state. |
| Ordering/concurrency | Last stock unit, concurrent approvals/cancel, old event after new version, N duplicate messages | Integration/E2E | PostgreSQL/RabbitMQ Testcontainers, multiple consumers | AC-282–287/293, T-246/247/251 | One valid winner; terminal/projection state never regresses; final state equals single in-order delivery. |
| Observability | Trace one lifecycle through logs/envelopes/DLQ | Integration/E2E | Test log appender, RabbitMQ | AC-293, T-245/251 | Stable correlation ID, immediate causation ID, event ID, and transaction ID are present with no sensitive credential. |
| Cutover/rollback | Shadow comparison, quiescence, exclusive binding/writer, Gateway target, pre-checkpoint rollback | Deployment/acceptance | Compose and migration fixtures | AC-290/291, T-252 | No dual writer; health and parity gates control routing; rollback is repeatable before the recorded checkpoint. |
| Node retirement | Repository/deployment inventory rejects active Node Workflow artifacts and stale consumers | Architecture/acceptance | Repository scanner, Compose config | AC-291/292, T-253 | Node Workflow, central saga, relay/broker and active deployment entries are absent without breaking public journeys. |

## Phase gate command set

Each task narrows the Java test selection during Red/Green and then runs the
complete relevant gate. The final task must run, at minimum:

```text
./gradlew :apps:payment-federation:cleanTest :apps:payment-federation:test
./gradlew :apps:payment-federation:jacocoTestReport
npx nx run-many -t typecheck lint test build
npx nx run e2e:e2e
docker compose config
node .agents/skills/onp-spec-driven/scripts/onp-spec.mjs verify migrate-order-workflow-to-axon-java
node .agents/skills/onp-spec-driven/scripts/onp-spec.mjs audit --ci
```

Commands may be corrected to match the final Gradle/Nx target inventory, but
no required test category may be silently omitted. The raw runner reports are
the authority for counts and pass/fail status.
