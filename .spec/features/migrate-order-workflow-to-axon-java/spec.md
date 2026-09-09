# Spec: Migrate Order Workflow to Axon Java

> feature: migrate-order-workflow-to-axon-java
> status: rascunho

## Context

`apps/order-workflow-subgraph` currently owns checkout idempotency,
WooCommerce reconciliation, a central order state machine, inbox/outbox
delivery, GraphQL operations, and the authenticated SSE stream. Those
responsibilities must move into the existing Java runtime without porting the
central `OrderSaga` or its payment-first workflow.

The target is one Java 21/Spring Boot modular monolith with explicit
Transaction, Inventory, and Payment bounded contexts. Each context owns its
domain decisions and PostgreSQL schema. Axon Framework 5.3.1 owns commands,
event-sourced state, internal event processing, CQRS projections, queries, and
subscription queries. Spring AMQP and RabbitMQ carry versioned Integration
Events across bounded-context boundaries, even while all contexts share one
JVM.

The saga is strictly choreographed. There is no saga coordinator, workflow
aggregate, process manager, or handler that knows and advances the complete
sequence. The target happy path is Inventory-first:

```text
OrderReceived -> InventoryReserved -> PaymentApproved
              -> InventoryCommitted -> TransactionCompleted
```

Domain Events remain internal facts. Application handlers map the subset that
must leave a context to versioned Integration Events, persist them through a
context-owned outbox, and publish them through Spring AMQP. Incoming AMQP
messages are deduplicated by a context-owned inbox and translated to an Axon
command. GraphQL, SSE, OAuth, PostgreSQL, RabbitMQ, Mercado Pago, and
WooCommerce remain outer adapters.

One PostgreSQL instance is used initially, with exclusive `transaction`,
`inventory`, and `payment` schemas and no cross-schema reads, joins, foreign
keys, or JPA relations between contexts. The persistent Axon Event Store,
processor/token storage, tables, schema, and transaction model remain **NEEDS
VALIDATION** until the exact Axon 5.3.1-supported implementation is proven.
There is no cache or search engine in the first version.

## User stories

### US-132 — Establish one Axon CQRS architecture in Java

As a maintainer, I want one documented DDD and Clean Architecture structure
with verified Axon 5 annotations so that every business operation has an
explicit owner and dependency direction before the Node workflow is retired.

#### AC-280 — Java sources follow the approved boundaries

- **Dado** the Transaction, Inventory, and Payment packages
- **Quando** production packages and imports are inspected
- **Então** each context separates domain, application, infrastructure, and interfaces, dependencies point inward, no context imports another context's internals, and only the documented Axon metadata exception reaches domain code

#### AC-281 — Commands, events, and queries have distinct paths

- **Dado** an operation that changes or reads business state
- **Quando** it enters the Java application
- **Então** a command reaches an Axon 5 command handler and event-sourced entity, Domain Events update dedicated projections, and an Axon query handler reads a view without loading an aggregate for display

#### AC-282 — Axon state is durable and replayable

- **Dado** Axon Framework 5.3.1 on Java 21 and Spring Boot 3
- **Quando** the application restarts, replays a stream, or another replica handles work
- **Então** events, processor positions, and projections remain durable in PostgreSQL and aggregate concurrency preserves each consistency boundary

### US-133 — Convert Payment and Inventory independently

As a maintainer, I want Payment and Inventory to use the target Axon structure
without direct calls between them so that the migrated Transaction context can
participate through stable asynchronous contracts.

#### AC-283 — Payment invariants and provider idempotency survive conversion

- **Dado** card, Pix, refund, provider-notification, duplicate, and conflicting payment intents
- **Quando** they execute through Axon command handlers and the PaymentProvider port
- **Então** the Payment aggregate emits only valid facts, rejects invalid transitions, performs each provider effect at most once, and exposes an equivalent replayable payment projection

#### AC-284 — Inventory remains independently consistent

- **Dado** order, payment, and cancellation Integration Events delivered once, repeatedly, concurrently, or out of order
- **Quando** Inventory translates them to local commands
- **Então** the Inventory aggregate applies reserve, commit, or release decisions idempotently, imports no Transaction or Payment internals, and publishes only its own result events

#### AC-293 — Bounded contexts communicate through RabbitMQ AMQP

- **Dado** a versioned fact that must leave its owning bounded context
- **Quando** an application event handler creates its Integration Event
- **Então** a context-owned outbox and Spring AMQP adapter publish it through the declared RabbitMQ topology, the consumer acknowledges only durable local handling, causal metadata is preserved, duplicates are harmless, and exhausted technical failures reach the consumer DLQ

### US-134 — Migrate checkout and transaction lifecycle to Java

As a buyer, I want checkout retries and the distributed order lifecycle to
remain reliable while their ownership moves from Node to Java.

#### AC-285 — Checkout remains idempotent across concurrency and ambiguity

- **Dado** repeated or concurrent checkout commands with one operation key
- **Quando** Transaction creates or reconciles a WooCommerce order through its ACL
- **Então** the same subject and semantic command observe one internal transaction and at most one WooCommerce order, while a different subject or command receives a deterministic conflict

#### AC-286 — The distributed lifecycle is strictly choreographed

- **Dado** an accepted Transaction and versioned Integration Events delivered once, repeatedly, concurrently, or out of order
- **Quando** the lifecycle runs
- **Então** Inventory reacts first to `OrderReceived`, Payment reacts only to `InventoryReserved`, each context issues only its own commands, compensation is expressed as new local operations, and no orchestrator or process manager advances the complete sequence

#### AC-287 — Transaction projections preserve observable state

- **Dado** a Transaction event history and the independently received Inventory and Payment outcomes
- **Quando** projections are built online or rebuilt by replay
- **Então** checkout status, transaction status, payment status/reference, inventory status, Pix code, version, owner, and WooCommerce reference are equivalent to the approved compatibility contract

### US-135 — Preserve federated GraphQL and realtime contracts

As an authenticated buyer, I want compatible GraphQL operations and a
transaction-filtered SSE stream after cutover so clients do not depend on the
implementation language.

#### AC-288 — Existing GraphQL operations remain compatible during cutover

- **Dado** the current Order Workflow federation schema and OAuth scopes
- **Quando** `startCheckout`, `checkout`, `Order.workflow`, and entity resolution execute against Java
- **Então** field names, nullability, federation keys, authorization, validation, and error codes remain compatible until a separately approved contract version replaces them

#### AC-289 — Axon subscription queries isolate transaction updates

- **Dado** an authenticated owner subscribing to one `transactionId`
- **Quando** Transaction projections change or the client reconnects
- **Então** the initial result and subsequent ordered updates flow through `QueryUpdateEmitter`, `subscriptionQuery`, `@SubscriptionMapping`, and `Flux` over SSE; no other transaction is emitted; and cancellation releases resources

### US-136 — Cut over safely and retire the Node runtime

As an operator, I want a reversible migration so Java can become the sole
Transaction owner without state loss, duplicate external effects, or two
command writers.

#### AC-290 — Existing durable state has an explicit migration decision

- **Dado** existing checkout, workflow, inbox, and outbox rows
- **Quando** the Java cutover is prepared
- **Então** either a tested, restartable import initializes event history and projections without external side effects, or an explicitly approved and tested clean-start gate proves no durable state requires migration

#### AC-291 — One Java deployment becomes the sole owner

- **Dado** successful shadow comparison and cutover checks
- **Quando** routing and deployment configuration change
- **Então** GraphQL and SSE traffic reach Java through Gateway, only one runtime accepts Transaction commands, health checks pass, rollback remains possible, and the Node Order Workflow is removed from active project and deployment inventories

#### AC-292 — Repository quality gates prove the migration

- **Dado** the completed migration
- **Quando** unit, Axon fixture, architecture, integration, contract, end-to-end, coverage, typecheck, lint, `onp-spec verify`, and `onp-spec audit --ci` gates run
- **Então** every applicable gate passes without critical skipped tests, weakened assertions, H2-as-PostgreSQL substitution, mocked RabbitMQ integration, or fabricated validation

## Out of scope

- Splitting Transaction, Inventory, or Payment into separate deployables.
- Adding Axon Server or a commercial Axoniq module without a separately approved persistence decision.
- Replacing RabbitMQ with an in-process cross-context bus.
- Replacing WooCommerce as the commerce system of record.
- Rewriting Mercado Pago beyond adapting it to the Payment ports and reliability protocol.
- Adding Redis, another cache, Elasticsearch/OpenSearch, or another search engine.
- Adding speculative base aggregates, generic repositories, handler hierarchies, or wrappers around Axon/Spring.
- Claiming that Apollo Federation routes GraphQL subscriptions without an executable protocol proof.

## Suposições

| ID | Assumption | Status | Resolution |
|---|---|---|---|
| ASM-100 | The existing Java 21/Spring Boot deployable remains one modular monolith for Transaction, Inventory, and Payment. | confirmada | Approved scope favors explicit package boundaries over new deployables. |
| ASM-101 | Public GraphQL, OAuth, WooCommerce, RabbitMQ, database, and SSE behavior remains compatible until an acceptance test approves a cutover difference. | confirmada | The requested change is architectural, not a silent client contract break. |
| ASM-102 | Axon Framework is pinned to 5.3.1, matching the local reference, while production persistence replaces its in-memory stores. | confirmada | The authoritative plan fixes Axon 5.x and the audited local reference declares 5.3.1. |
| ASM-103 | RabbitMQ remains mandatory for every asynchronous bounded-context boundary. | confirmada | The authoritative plan requires Axon 5 plus Spring AMQP/RabbitMQ. |
| ASM-104 | Identity remains the OAuth issuer and Gateway remains the public GraphQL/SSE edge during the first cutover. | confirmada | Current ownership is evidenced and no requirement transfers identity or public-edge ownership. |
| ASM-105 | One PostgreSQL instance with exclusive `transaction`, `inventory`, and `payment` schemas is the initial persistence topology. | confirmada | This is fixed by the authoritative database decision. |

## Perguntas em aberto

| ID | Question | Status | Answer |
|---|---|---|---|
| Q-019 | Which Axon 5.3.1-compatible persistent Event Store, token/processor store, sequencing, and dead-letter implementation will be selected, and which schema/tables/transaction manager will it require? | aberta | **NEEDS VALIDATION** before the persistence implementation phase. |
| Q-020 | Should the deployable eventually be renamed from `payment-federation` after it owns three contexts? | aberta | Keep the current path during migration; a rename is optional after verified cutover. |
| Q-021 | Does cross-context choreography remain on RabbitMQ when contexts share one JVM? | respondida | Yes. Axon is internal to a context; Spring AMQP/RabbitMQ carries Integration Events across contexts. |
| Q-022 | Must legacy Workflow rows be imported, or is an empty-state cutover acceptable? | aberta | Inventory production data and obtain owner approval before choosing importer or clean start. |
| Q-023 | Should the Axon AMQP 4.11 artifact be mixed into Axon 5.3.1? | respondida | No. Use the already-present Spring AMQP integration; the reference contains no Axon AMQP extension. |
| Q-024 | What are the approved terminal Transaction states and the policy for inventory commit failure after payment approval? | respondida | An inventory commit failure after payment approval must request an idempotent refund. Payment transitions through `REFUND_PENDING` and converges to terminal `REFUNDED`; Transaction records the compensated failure without regressing after duplicate or out-of-order events. |
| Q-025 | Must “WordPress/GraphiQL surface” mean an endpoint hosted by WordPress, or may Gateway GraphiQL be the public surface over the composed WordPress graph? | aberta | Current evidence proves only Gateway SSE. A WordPress-hosted proxy/plugin is **NEEDS VALIDATION** and blocks that specific acceptance claim. |
| Q-026 | What are the retention, lease timeout, abandoned-checkout cleanup, payment-token classification, redaction, and retry rules? | aberta | Security and operational owners must decide before the affected implementation phases. |
