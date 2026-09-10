# T-240 — Current Java Runtime and Axon 5 Reference Audit

## Scope and evidence standard

This audit covers every project-owned file below `apps/payment-federation` and every project-owned source, resource, test, script, and build descriptor in `../axon-graphql-posts`. Generated output, Gradle/Maven caches, IDE metadata, and Git metadata are not architecture inputs. The three approved files in `/home/kaiosilva/Downloads` are authoritative requirements.

Labels mean:

- **KEEP**: behavior or boundary can remain.
- **REFACTOR**: retain intent but change implementation.
- **MOVE**: retain implementation intent under a different layer/context.
- **SPLIT**: one artifact currently contains multiple architectural roles.
- **REMOVE**: the target architecture must not retain this mechanism.
- **CREATE**: required target artifact is absent.
- **NEEDS VALIDATION**: the inspected evidence cannot prove the claim.

Commands used as evidence:

```text
find apps/payment-federation -type f
find ../axon-graphql-posts -type f
rg -n <symbols and dependencies> <both source trees>
unzip -Z1 apps/payment-federation/build/libs/payment-federation-0.0.1-SNAPSHOT.jar
docker run ... gradle:8.14.3-jdk21 gradle --no-daemon test
./mvnw test  # reference: did not start because JAVA_HOME is unset
```

## Executive conclusion

`payment-federation` is a Java 21/Spring Boot 3.5.6 modular monolith containing two partially separated bounded contexts, Payment and Inventory. It has explicit domain/application/adapter/configuration packages, JDBC inbox/outbox tables, Spring AMQP consumers, GraphQL Federation, OAuth resource-server enforcement, Mercado Pago, and WordPress/WooCommerce adapters. Its 35 current tests pass.

It is **not an Axon application**: neither Axon nor Reactor is declared or packaged; there are no Axon commands, event-sourced entities, event handlers, query gateways, projections, subscription queries, or persistent Axon infrastructure. The package name `dev.desafio.transaction` is only a namespace; there is no Order/Transaction domain implementation in this module.

The current code is not yet compatible with the approved target architecture. The highest-risk gaps are: no Axon 5 CQRS/Event Sourcing; Payment invokes an external provider before its durable inbox claim; Payment synchronously calls WordPress after authorization; outbox records have no relay/recovery process; migrations mix contexts in the default schema; and integration tests use H2/mocks instead of PostgreSQL and RabbitMQ Testcontainers.

The reference proves concrete Axon **5.3.1** APIs and GraphQL-over-SSE composition. It is a useful implementation reference, not a production persistence or messaging template: it deliberately uses in-memory Axon event/token stores, SQLite auto-DDL, no RabbitMQ, no inbox/outbox, no OAuth, and no integration-test suite.

## Effective versions

| Component | `payment-federation` evidence | Effective version/status | Reference evidence | Reference version/status |
|---|---|---|---|---|
| Java | `build.gradle.kts:12-15`; `Dockerfile:1,6` | Java 21; runtime image `eclipse-temurin:21.0.8_9-jre` | `pom.xml:20-24` | Java 21 |
| Build tool | `project.json:11,18`; `Dockerfile:1` | Gradle 8.14.3 | `.mvn/wrapper/maven-wrapper.properties`; `pom.xml` | Maven wrapper; exact Maven distribution is declared by the wrapper |
| Spring Boot | `build.gradle.kts:5`; packaged `spring-boot-3.5.6.jar` | 3.5.6 | `pom.xml:7-11` | 3.5.16 |
| Spring Framework | packaged `spring-core-6.2.11.jar` | 6.2.11 | managed by Boot parent | **NEEDS VALIDATION** as a resolved artifact |
| Axon Framework | absent from `build.gradle.kts:22-39` and packaged libraries | **Absent** | `pom.xml:24,30-40,82-93` | 5.3.1 BOM/starter/reactor |
| Axon AMQP | absent | **Absent** | absent from `pom.xml:42-111` | **Absent**; the reference does not prove Axon AMQP compatibility |
| Spring GraphQL | `build.gradle.kts:24`; packaged `spring-graphql-1.4.2.jar` | 1.4.2; GraphQL Java 24.1 | `pom.xml:43-51` | managed by Boot 3.5.16; **NEEDS VALIDATION** as resolved artifacts |
| Spring AMQP / Rabbit client | `build.gradle.kts:27`; packaged libraries | Spring AMQP/Spring Rabbit 3.2.7; Rabbit client 5.25.0 | absent | Absent |
| PostgreSQL | `build.gradle.kts:34-36`; packaged libraries | driver 42.7.7; Flyway 11.7.2 | absent | Absent; SQLite is used instead (`pom.xml:68-80`) |
| Apollo federation support | `build.gradle.kts:33` | 5.5.0 | absent | Absent |
| Mercado Pago SDK | `build.gradle.kts:30` | 3.3.1 | absent | Absent |
| Reactor | packaged `reactor-core-3.7.11.jar`; no Axon Reactor | Reactor Core 3.7.11 is transitive | `pom.xml:87-93` | Axon Reactor 5.3.1 |
| Test database | `build.gradle.kts:38`; test source cited below | H2 declared; exact resolved H2 version **NEEDS VALIDATION** | SQLite/read model; in-memory Axon stores | No Testcontainers |

## Current module and package inventory

### Runtime and resources

| Artifact/package | Actual responsibility and evidence | Classification |
|---|---|---|
| `PaymentFederationApplication` | Spring composition root (`PaymentFederationApplication.java:1-10`). | **KEEP**, then **MOVE** to a neutral application root name when Order/Transaction joins. |
| `dev.desafio.transaction.payment.domain` (1 file) | `Payment` enforces amount/currency/method/status/refund invariants (`Payment.java:23-45,47-95`) but also nests commands and serialized outgoing-event shape (`Payment.java:165-247`). | **SPLIT**: keep aggregate behavior; move commands to application and integration contracts to an outer contract package. |
| `payment.application` (10 files including subpackages) | Ports, Payment use cases, explicit command/query handlers and view. `PaymentHandler` calls provider then repository (`PaymentHandler.java:24-31`). | **REFACTOR** to Axon 5 command/query handlers and explicit ports; preserve use-case intent. |
| `payment.adapter.graphql` (1 file) | Federated query/mutation/entity resolver with scope checks (`PaymentController.java:30-54`). | **REFACTOR** to Reactor gateways and add subscription adapter; retain GraphQL boundary/security. |
| `payment.adapter.messaging` (2 files) | Contract parsing, dispatch, publish confirms, retry, DLQ, ack/nack are combined (`PaymentRabbitListener.java:46-67,70-185`). | **SPLIT** into inbound contract mapper/listener, application dispatch, outbox relay, retry/DLQ infrastructure. |
| `payment.adapter.persistence` (2 files) | JDBC state, inbox, effect and outbox atomic writes (`JdbcPaymentRepository.java:52-80,217-380`) plus provider-webhook persistence. | **REFACTOR/SPLIT** into Axon write persistence, Payment projection, inbox, outbox and notification repositories. |
| `payment.adapter.mercadopago` (2 files) | Provider SDK adapter and authenticated webhook controller (`MercadoPagoPaymentProvider.java:18-89`; `MercadoPagoWebhookController.java:22-67`). | **KEEP/REFACTOR** behind application ports; do not leak SDK types inward. |
| `payment.adapter.provider` (1 file) | Deterministic local/test provider. | **KEEP** as test/local adapter only. |
| `payment.adapter.wordpress` (2 files) | Direct WordPress mutation and shared token acquisition. | `WpGraphqlAuthentication`: **MOVE/REFACTOR** to shared outer integration support if still needed. `WordPressOrderPaymentAdapter`: **REMOVE** from Payment happy path; replace cross-context state change with integration events. |
| `payment.configuration` (5 files) | Spring wiring, GraphQL Federation, AMQP topology, OAuth/JWT, provider properties. Query SQL is embedded in composition (`PaymentConfiguration.java:34-39,96-114`). | **SPLIT/MOVE** by adapter; move SQL into projection persistence. Keep security and property validation behavior. |
| `dev.desafio.transaction.inventory.domain` (1 file) | Inventory transport-shaped requests/results and exceptions (`Inventory.java:12-66`); no inventory aggregate state. | **SPLIT/CREATE** a real Inventory aggregate/domain events; move message envelopes outward. |
| `inventory.application` (3 files) | Reservation/reconciliation use case and persistence/external-stock ports (`InventoryService.java:27-68`). | **KEEP/REFACTOR** local decision flow; replace service entry with Axon command handling. |
| `inventory.adapter.messaging` (1 file) | Listener, serialization, publish, retry/DLQ and ack combined. | **SPLIT**, same boundary as Payment. |
| `inventory.adapter.persistence` (1 file) | Durable claim lease, inbox and outbox using JDBC (`JdbcInventoryRepository.java:22-84,86-213`). | **REFACTOR/SPLIT** into aggregate/event persistence decision, projection, inbox and outbox adapters. |
| `inventory.adapter.wordpress` (1 file) | WooCommerce/WordPress stock query and mutation through Java `HttpClient`. | **KEEP/REFACTOR** behind `StockPort`; contract and ambiguity tests are missing. |
| `inventory.configuration` (2 files) | Spring wiring and AMQP topology. | **SPLIT/MOVE** by adapter; retain explicit topology intent. |
| `application.yaml` | OAuth, manual acknowledgement, prefetch, confirms and provider profiles (`application.yaml:1-49`); no datasource/schema/Flyway ownership. | **REFACTOR** for three schema boundaries and Axon 5 persistence after validation. |
| `payment.graphqls` | Payment Federation entity, query and mutation only (`payment.graphqls:1-47`). | **KEEP/EXTEND**; add target subscriptions and validation contract. |
| Flyway V1–V4 | Creates Payment, Inventory, inbox/outbox and webhook tables without schema qualification. V3 mixes Inventory and Payment changes (`V3__mercado_pago_payment_lifecycle.sql:1-60`). | **REFACTOR/SPLIT** into context-owned, schema-qualified migration streams. |
| `Dockerfile`, `project.json`, Gradle descriptors | Java 21 multi-stage runtime and Nx Gradle commands (`Dockerfile:1-13`; `project.json:7-19`). | **KEEP/REFACTOR** dependencies and acceptance targets; add Testcontainers only to tests. |

There are 36 main Java files: 1 bootstrap, 26 Payment files, and 9 Inventory files. There is no third Order/Transaction package despite the common `transaction` prefix.

### Current tests

| Test area | Evidence | Result/classification |
|---|---|---|
| Domain/application behavior | `PaymentHandlerTest`, `InventoryServiceTest`, `ProviderNotificationHandlerTest` | **KEEP/REFACTOR** into pure domain/Axon fixture tests. |
| GraphQL/security | `PaymentFederationTest:51-59,100-180,257-274` starts Spring but mocks handlers/JWT and disables DB/Flyway. | **KEEP** boundary assertions; **CREATE** real integration coverage. |
| Persistence/migrations | `PaymentMigrationTest:79-114` inspects SQL strings and starts H2 with Flyway disabled; `PaymentFederationTest:191-219` manually creates an H2 table. | **REMOVE** H2 as PostgreSQL substitute; **CREATE** PostgreSQL Testcontainers migration/projection tests. |
| Messaging/redelivery | `PaymentRedeliveryTest:24-88` uses an in-memory repository and no RabbitMQ/listener. | **KEEP** unit intent; **CREATE** RabbitMQ Testcontainers contract, redelivery, retry and DLQ tests. |
| Architecture | `ArchitectureBoundariesTest:19-46` scans imports with regex and recognizes only Payment/Inventory/layers. | **REFACTOR** to ArchUnit and enforce context isolation/no orchestrator/no vendor-domain imports. |
| Mercado Pago/webhook | Adapter and webhook unit tests exist. | **KEEP**, then add contract/integration coverage for pending/approved/rejected/refund/webhook flows. |
| Executed proof | Gradle command completed successfully on 2026-09-09. XML reports contain 35 tests, 35 passed, 0 failed, 0 skipped, 0 errors. | Current suite **PASS**; it does not prove target requirements. |

Absent test categories: Axon replay/version/order/side-effect safety; Axon dispatch; projections rebuilt from event streams; real PostgreSQL/Flyway; real RabbitMQ topology/metadata/redelivery/outage; outbox relay recovery; choreographed saga; GraphQL subscription/SSE and transaction filtering; WordPress SSE acceptance; full E2E; cross-context concurrency/ordering; schema isolation; persistent Axon infrastructure.

## Database, table, and migration ownership

All SQL names are unqualified and no `CREATE SCHEMA` or `search_path` exists in the module. Therefore the current physical schema is determined by the datasource/default PostgreSQL user configuration and is **NEEDS VALIDATION**; it cannot be claimed as `payment`, `inventory`, or `transaction` from this module.

| Current table | Intended current owner inferred from writers | Purpose/evidence | Target action |
|---|---|---|---|
| `payment_record` | Payment | Payment state (`V1:1-16`; modified by `V3:21-43`). | **MOVE** to `payment`; decide whether it is an Axon-derived projection or another owned model. |
| `payment_effect` | Payment | Idempotent external-effect ledger (`V1:18-26`; `JdbcPaymentRepository.java:217-237`). | **REFACTOR** after Axon consistency-boundary design. |
| `payment_outbox` | Payment | Versioned integration events and publication metadata (`V1:28-43`). | **KEEP/REFACTOR** in `payment`; add an actual relay and recovery state machine. |
| `payment_inbox` | Payment | Incoming-event deduplication/result correlation (`V1:45-50`; `V3:57-60`). | **KEEP/REFACTOR** in `payment`. |
| `provider_notification_inbox` | Payment | Provider webhook deduplication/status (`V4:1-19`). | **KEEP** in `payment`. |
| `inventory_operation` | Inventory | Lease/claim state around ambiguous WooCommerce effects (`V3:1-19`). | **KEEP/REFACTOR** in `inventory`. |
| `inventory_outbox` | Inventory | Stock integration results (`V2:1-14`). | **KEEP/REFACTOR** in `inventory`; add relay fields/worker or a separate owned delivery table. |
| `inventory_inbox` | Inventory | Incoming-event/result deduplication (`V2:16-20`). | **KEEP/REFACTOR** in `inventory`. |
| Order/Transaction tables | None | No Java Order/Transaction model or migration exists. | **CREATE** under `transaction`. |
| Axon event/token/dead-letter tables | None | Axon is absent. | **NEEDS VALIDATION** against the selected Axon 5.3 persistent implementation before naming tables or schema; do not assign them to a business context yet. |

No current SQL performs a cross-context join. However V3 combines both contexts in one version stream, all tables share an unresolved default schema, and neither database roles nor migration locations enforce ownership. A shared PostgreSQL instance is feasible, but the approved `transaction`, `inventory`, and `payment` schemas and no-cross-schema rule are not implemented.

## Findings and severity

| Severity | Finding | Exact evidence | Required classification |
|---|---|---|---|
| Critical | Axon 5 CQRS/Event Sourcing is absent. | No Axon dependency in `build.gradle.kts:22-39`; no Axon library in the boot JAR; no `org.axonframework` imports. | **CREATE/REFACTOR**. |
| Critical | Payment can execute an external provider effect before durable inbox deduplication. | `PaymentHandler.java:24-31` calls `provider.execute` before `repository.process`; inbox claim starts inside `JdbcPaymentRepository.java:52-59`. | **REFACTOR** so durable/local decision and effect protocol prevent duplicate provider calls. |
| Critical | Payment performs synchronous cross-context/order mutation after local handling, which is incompatible with strict choreography. | `AuthorizePaymentHandler.java:23-29` invokes `orders.record`; Spring wires `WordPressOrderPaymentAdapter` at `PaymentConfiguration.java:86-94,116-123`. | **REMOVE** this coupling; publish/consume versioned integration events. |
| Critical | Required database boundaries do not exist. | V1–V4 use unqualified tables; V3 edits Inventory and Payment objects; `application.yaml` has no datasource schema ownership. | **SPLIT/MOVE/CREATE** schema-qualified migration streams and isolation tests. |
| High | Outbox persistence is not an independently recoverable publisher. | `JdbcPaymentRepository.java:64-75` commits an outbox row; `PaymentRabbitListener.java:50-67,110-142` immediately publishes and ACKs. `sent_at`/`publication_attempts` from `V1:36-37` have no production writer; Inventory has no delivery columns. | **CREATE** relay/recovery and outage tests. |
| High | Domain files contain application commands and RabbitMQ-shaped integration events. | `Payment.java:165-247`; `Inventory.java:33-66` includes `eventId`, `eventType`, `eventVersion`, operation key and map payload. | **SPLIT/MOVE**. |
| High | Listener classes combine too many responsibilities. | `PaymentRabbitListener.java:46-203`; `InventoryRabbitListener.java:48-209`. | **SPLIT** only along real boundaries: deserialize/validate, dispatch, retry/DLQ, publishing. |
| High | Approved PostgreSQL/RabbitMQ integration testing is absent and H2 is used as PostgreSQL. | `build.gradle.kts:37-38`; `PaymentFederationTest.java:191-219`; `PaymentMigrationTest.java:101-114`; no Testcontainers dependency/import. | **REMOVE/CREATE**. |
| High | No GraphQL subscription or SSE flow exists. | `payment.graphqls:41-47` has only Query/Mutation; no `@SubscriptionMapping`, `QueryUpdateEmitter`, or Axon Reactor gateway. | **CREATE** from proven reference pattern. |
| Medium | Query persistence leaks into Spring configuration and duplicates row mapping. | `PaymentConfiguration.java:34-39,96-114`; similar SQL/mapping appears in test `PaymentFederationTest.java:207-216`. | **MOVE** to a Payment projection repository. |
| Medium | The `transaction` namespace suggests a context not implemented here. | Only `inventory` and `payment` context directories exist; architecture test asserts only those at `ArchitectureBoundariesTest.java:30-45`. | **CREATE** explicit Order/Transaction context and rename neutral roots deliberately. |
| Medium | Architecture test is a narrow regex scanner and cannot prove all required dependencies/annotations/no hidden orchestrator. | `ArchitectureBoundariesTest.java:19-46`. | **REFACTOR** to ArchUnit plus focused structural tests. |
| Medium | Configuration reads environment variables directly instead of binding typed properties. | `InventoryConfiguration.java:24-43`; `PaymentConfiguration.java:116-129`. | **REFACTOR** using validated `@ConfigurationProperties`. |
| Low | Test compilation reports unchecked/unsafe operations in `MercadoPagoPaymentProviderTest`. | Gradle test output. | **REFACTOR** when touching those tests. |

## Complete local reference inventory and comparison

### Reference package map

| Reference package/module | Role and exact evidence | Reuse decision |
|---|---|---|
| `domain.post`, `domain.tag`, `domain.shared` | Rich entities, value objects, domain events, repository/event-publisher ports. `Post` is both JPA and Axon event-sourced (`Post.java:63-65,228-249`); events carry Axon 5 `@Event`/`@EventTag`. | **ADAPT**, not copy. Preserve behavior-first entities and event reconstruction; decide JPA co-location per target model. |
| `application.*.command` | One annotated command and one handler per use case; `@CommandHandler`, `@InjectEntity`, `EventAppender` (`CreatePostCommandHandler.java:50-68`). | **ADAPT** as verified Axon 5.3 syntax. |
| `application.post.event` | `@EventHandler` plus `QueryUpdateEmitter`; processor selected by package-level `@Namespace` and `EventProcessorDefinition`. | **ADAPT** for projections/subscription updates; RabbitMQ publication still belongs in infrastructure/outbox. |
| `application.*.query` | `@QueryHandler` query side and pagination DTOs. | **ADAPT** for CQRS query handlers. |
| `application.post.subscription` | Axon 5 requires an initial `@QueryHandler`; Reactor gateway opens the subscription (`OnPostCreatedSubscriptionHandler.java:39-47`). | **ADAPT** for transaction-filtered subscriptions. |
| `interfaces.graphql` | Thin query/mutation/subscription controllers. `@SubscriptionMapping` returns `Flux` (`PostSubscriptionController.java:23-43`). | **ADAPT** and add OAuth/Federation constraints. |
| `infrastructure.axon` | Explicit in-memory `EventStorageEngine`, `TokenStore`, and subscribing processor (`AxonConfig.java:38-60`). | **REMOVE/REPLACE** in production target; useful only to identify Axon 5 bean APIs. |
| `infrastructure.persistence.sqlite` | JPA adapters and Spring Data repositories for read model. | **REPLACE** with PostgreSQL, schema-owned projections and versioned migrations. |
| `dto`, `mapper`, `exceptions` | Boundary DTOs, MapStruct translation, GraphQL error mapping. | **ADAPT only where useful**; do not add MapStruct unless compile-time mapping removes real duplication. |
| `src/main/resources/graphql/posts.graphqls` | Query/mutation/subscription schema (`posts.graphqls:39-85`). | **ADAPT** subscription shape/filter semantics. |
| `application.yml` | GraphQL SSE keepalive and explicit exclusion of persistent Axon auto-config (`application.yml:19-45`). | **ADAPT** SSE settings; **DO NOT COPY** in-memory persistence exclusions. |
| Tests/support | Pure domain tests, Axon 5 `AxonTestFixture`, in-memory ports, cursor tests. | **ADAPT** fixture construction and pure-domain style; add missing real infrastructure tests. |
| `scripts/poc-smoke.sh` | End-to-end POC smoke script for GraphQL/SSE. | **ADAPT** only as acceptance evidence; replace shell timing assumptions with deterministic integration tests where possible. |

### Proven Axon 5.3.1 patterns

- BOM plus `axon-spring-boot-starter` and explicit `axon-reactor` 5.3.1: `pom.xml:24,30-40,82-93`.
- Event-sourced entity annotation and creation/sourcing lifecycle: `Post.java:63-65,228-249` and `Tag.java:30-32,76`.
- Commands use Axon 5 annotations and target identity: `CreatePostCommand.java:4-15`.
- Handlers inject reconstructed entities and an `EventAppender`: `CreatePostCommandHandler.java:50-68`.
- Event handlers receive `QueryUpdateEmitter`: `PostCreatedEventHandler.java:32-47`.
- A subscription has an initial `@QueryHandler`, calls `ReactorQueryGateway.subscriptionQuery`, and reaches `@SubscriptionMapping -> Flux`: `OnPostCreatedSubscriptionHandler.java:39-47`; `PostSubscriptionController.java:35-43`.
- Subscribing event processor configuration uses `EventProcessorDefinition.subscribingMatching`: `AxonConfig.java:51-55`; package selection uses `@Namespace` at `application/post/event/package-info.java:20-33`.
- Axon 5 handler tests use `AxonTestFixture`, not an Axon 4 fixture assumption: `CreatePostCommandHandlerTest.java:25-53` and `support/PostCommandFixtures.java:38-46`.

### Reference limitations that must not become target assumptions

- Event store and token store are deliberately in memory (`AxonConfig.java:41-49`); restart durability, production event tables, processor tokens, dead letters, and replay recovery are **NEEDS VALIDATION**.
- Axon JPA/JDBC auto-configuration is explicitly excluded (`application.yml:29-35`), so the reference proves no Axon database schema.
- SQLite uses `ddl-auto: update` (`application.yml:5-17`), which violates the target production migration rule.
- There is no RabbitMQ/Spring AMQP, inbox/outbox, retry/DLQ, OAuth resource server, Federation, Mercado Pago, WooCommerce, choreographed saga, Testcontainers, or persistent production deployment.
- The README explicitly acknowledges that the saved read model is not derivable by replay in its current command-save design (`README.md:247-249`). The target must project from events and prove rebuild.
- Reference tests were not executed in this audit because `./mvnw test` failed before Maven start: `JAVA_HOME` is unset. Source-level comparison is complete; runtime status is **NEEDS VALIDATION** with `JAVA_HOME=<JDK21> ./mvnw test`.

## Required target actions derived from this audit

| Classification | Minimum action |
|---|---|
| **KEEP** | Java 21, Spring Boot, Spring GraphQL, Spring AMQP, PostgreSQL/Flyway, OAuth resource server, explicit adapters, provider/webhook validation, local Inventory claim/reconciliation knowledge, current public Payment GraphQL contract unless separately versioned. |
| **REFACTOR** | Payment/Inventory use cases into Axon 5 commands, handlers, event-sourced aggregates and event-driven projections; JDBC ownership; AMQP adapters; typed configuration; tests. |
| **MOVE** | Integration envelopes out of domain; projection SQL out of configuration; every table/migration into its owned schema stream; reusable WordPress authentication to an outer technical boundary. |
| **SPLIT** | `Payment.java`, `Inventory.java`, both Rabbit listeners, JDBC repositories, migration V3, and broad configuration classes. |
| **REMOVE** | Direct Payment-to-WordPress order update, H2-as-PostgreSQL tests, any production in-memory Axon store, and any proposal to use Axon AMQP 4.x without explicit compatibility proof. |
| **CREATE** | Order/Transaction context; Axon 5.3 dependency/configuration; commands/domain events/event-sourced entities; projections/query handlers; subscription query/SSE flow; versioned integration-event contracts; Spring AMQP inbound adapters and outbox relays; three schemas/migration streams; ArchUnit; PostgreSQL/RabbitMQ Testcontainers; saga/E2E/concurrency/ordering/observability tests. |

## NEEDS VALIDATION register

1. Select and prove the exact persistent Event Store, token store, sequencing/dead-letter implementation supported by Axon 5.3.1; then determine whether a dedicated `axon` schema is required.
2. Confirm resolved transitive versions for the reference with `JAVA_HOME=<JDK21> ./mvnw dependency:tree`; only declared Boot 3.5.16/Axon 5.3.1/MapStruct 1.6.3 are currently proven.
3. Execute `JAVA_HOME=<JDK21> ./mvnw test` in the reference; source inspection cannot replace runtime proof.
4. Determine the current runtime datasource URL/default PostgreSQL schema from deployment configuration; `payment-federation` itself does not define it.
5. Define which current JDBC records remain authoritative projections versus migration-only compatibility data after Event Sourcing is introduced.
6. Define event retention, snapshot policy, replay/upcaster strategy, and migration path for already persisted non-event-sourced Payment/Inventory records.
7. Validate the target GraphQL Federation/SSE routing path end-to-end through the actual gateway and WordPress surface; the Java module currently has no subscription.
8. Validate Amazon RDS/Amazon MQ operational settings (TLS, credentials, topology permissions, HA, backup/restore) without introducing AWS APIs into Domain/Application.

## Internal consistency check

- Every current main Java package/resource/build artifact is represented by a row or grouped package row above.
- Every reference main/test/resource/script/build area is represented by the reference package map.
- The dependency table distinguishes declared, packaged/resolved, absent, and unverified versions.
- The database table count is eight current tables: five Payment-owned and three Inventory-owned; zero Order/Transaction and zero Axon tables.
- No claim states that the current passing 35-test suite validates PostgreSQL, RabbitMQ, Axon, SSE, choreography, or persistent replay.
- No production code, dependency, configuration, migration, shared specification, design, or task file was changed by T-240.
