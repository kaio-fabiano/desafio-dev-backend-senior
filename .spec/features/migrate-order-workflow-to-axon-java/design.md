# Design: Java/Axon Transaction Runtime

## Decision summary

Move the Node Order Workflow responsibilities into the existing Java 21 and
Spring Boot deployable as a modular monolith with three explicit bounded
contexts: Transaction, Inventory, and Payment. Keep Identity as OAuth issuer,
Gateway as the public GraphQL/SSE edge, and WordPress/WooCommerce as the
external commerce system of record.

Use Axon Framework 5.3.1 only inside each bounded context for commands,
event-sourced entities, Domain Events, processors, projections, queries, and
subscription queries. Use Spring AMQP and RabbitMQ for every asynchronous
cross-context message. Never use `axon-amqp:4.x` in the Axon 5 runtime.

The saga is strict choreography. No `OrderWorkflow`, `OrderSaga`, coordinator,
Axon saga, or process manager may know or drive the whole sequence. Transaction
records its own lifecycle; it does not command Inventory or Payment directly.

## Evidence basis

- The Java audit proves Java 21, Spring Boot 3.5.6, Spring GraphQL 1.4.2,
  Spring AMQP 3.2.7, Rabbit client 5.25.0, PostgreSQL driver 42.7.7, and Flyway
  11.7.2; Axon is currently absent: `audit-current-java.md`, “Effective
  versions”.
- The Workflow audit proves that `OrderSaga` centralizes the state graph and
  that checkout currently publishes `payment.requested` before Inventory:
  `audit-current-workflow.md`, Sections 2 and 5.
- The local reference proves Axon 5.3.1 patterns using `@EventSourced`,
  `@EntityCreator`, `@EventSourcingHandler`, `@TargetEntityId`,
  `@InjectEntity`, `EventAppender`, `QueryUpdateEmitter`,
  `subscriptionQuery`, `@SubscriptionMapping`, `Flux`, `@Namespace`, and
  `EventProcessorDefinition`: `audit-current-java.md`, “Proven Axon 5.3.1
  patterns”.
- The reference deliberately uses in-memory Axon stores and SQLite; it proves
  no production persistence or AMQP choice: `audit-current-java.md`,
  “Reference limitations”.
- The authoritative requirements are the three approved files in
  `/home/kaiosilva/Downloads/`.

## Bounded-context map

```text
Identity BC (existing) ---- OAuth/JWKS ----> Gateway public edge
                                               |
                                      GraphQL + SSE proxy
                                               v
                                  Java modular monolith

  Transaction BC -- transaction.order-received.v1 --> RabbitMQ --> Inventory BC
  Transaction BC <-- inventory.*.v1 ---------------- RabbitMQ <-- Inventory BC
  Payment BC     <-- inventory.reserved.v1 ---------- RabbitMQ <-- Inventory BC
  Payment BC     -- payment.*.v1 -------------------- RabbitMQ --> Transaction BC
  Payment BC     -- payment.*.v1 -------------------- RabbitMQ --> Inventory BC

  Transaction BC -- ACL --> WordPress/WooCommerce order API
  Inventory BC   -- port --> WooCommerce stock API
  Payment BC     -- port --> Mercado Pago
```

Shared JVM and shared PostgreSQL server do not weaken these boundaries.
Contexts exchange only versioned Integration Events and opaque identities.
There are no cross-context Java imports, service/repository calls, SQL joins,
foreign keys, or JPA relationships.

## Target package structure

```text
apps/payment-federation/src/main/java/dev/desafio/transaction/
├── transaction/
│   ├── domain/{model,event,vo}/
│   ├── application/{command,event,query,subscription,port}/
│   ├── infrastructure/{persistence,messaging,wordpress}/
│   └── interfaces/{graphql,security}/
├── inventory/
│   ├── domain/{model,event,vo}/
│   ├── application/{command,event,query,port}/
│   ├── infrastructure/{persistence,messaging,wordpress}/
│   └── interfaces/
├── payment/
│   ├── domain/{model,event,vo}/
│   ├── application/{command,event,query,port}/
│   ├── infrastructure/{persistence,messaging,mercadopago}/
│   └── interfaces/{graphql,http}/
├── contracts/integration/v1/
└── configuration/
```

Directories are created only when concrete behavior needs them. Integration
contracts contain no domain entity, Spring AMQP, provider, or GraphQL types.

## Dependency and annotation policy

```text
interfaces --------> application --------> domain
infrastructure ----> application --------> domain
configuration -----> outer adapters
```

Domain code contains behavior, invariants, value objects, and Domain Events.
The narrow metadata exception permits only verified Axon 5 event-sourcing
annotations required by the selected entity model. Application code may use
verified Axon handler/gateway types. JPA, Spring AMQP, GraphQL, HTTP, OAuth,
Mercado Pago, WooCommerce, SQL, and concrete repositories remain outside the
domain. An ArchUnit allowlist must encode the exception rather than relying on
directory names.

Do not add generic aggregate bases, framework wrappers, factories, or one-use
interfaces. Ports are justified only at real external boundaries or where the
application owns the dependency contract.

## Consistency boundaries

| Context | Aggregate / consistency boundary | Invariants | Ports |
|---|---|---|---|
| Transaction | `Transaction` | operation key binds owner and semantic command; one internal transaction and at most one Woo order; monotonic local statuses; terminal state cannot regress | WooCommerce order ACL, Transaction projection repository, inbox/outbox |
| Inventory | `InventoryReservation` | one reservation per transaction/SKU set; stock cannot be over-reserved; commit/release are mutually valid and idempotent | Stock port, Inventory projection repository, inbox/outbox |
| Payment | `Payment` | valid status transitions; amount/currency immutability; provider effect and approval occur at most once; refund requires an approved payment | PaymentProvider, Payment projection/effect repository, provider inbox, AMQP inbox/outbox |

The Transaction aggregate may record independently received status facts and
complete when its own terminal invariant is satisfied. It never emits a
command for another context. That is lifecycle ownership, not orchestration.

## Internal Axon flow

```text
GraphQL mutation / AMQP inbound adapter
  -> ReactorCommandGateway or CommandGateway
  -> @CommandHandler + @InjectEntity
  -> event-sourced entity decision
  -> EventAppender
  -> immutable Domain Event
  -> @EventSourcingHandler reconstructs state without I/O
  -> @EventHandler updates projection and QueryUpdateEmitter

GraphQL query
  -> ReactorQueryGateway
  -> @QueryHandler
  -> PostgreSQL view

GraphQL subscription
  -> ReactorQueryGateway.subscriptionQuery(...)
  -> initial @QueryHandler result + QueryUpdateEmitter updates
  -> @SubscriptionMapping
  -> Flux
  -> Spring GraphQL SSE
```

Only Axon 5 APIs demonstrated by the local reference or official 5.3
documentation may be planned. Aggregate fixture syntax, persistent-store
configuration, and processor semantics not proved by those sources are
**NEEDS VALIDATION**.

## Domain Events and Integration Events

Domain Events use business names within their owning context, for example
`TransactionCreated`, `InventoryReserved`, and `PaymentApproved`. They drive
event sourcing and local projections and are not serialized directly to AMQP.

For a fact that must leave a context:

```text
Domain Event
  -> context application event handler
  -> Integration Event mapper
  -> versioned IntegrationEventEnvelope
  -> context outbox
  -> Spring AMQP relay with mandatory publish + confirm
  -> RabbitMQ
```

The V1 envelope contains `eventId`, `eventType`, `version`, `aggregateId`,
`transactionId`, `correlationId`, `causationId`, `occurredAt`, and `payload`.
`correlationId` remains stable through one transaction lifecycle;
`causationId` is the source message/event identifier. Payloads never contain
provider SDK types or a reusable payment credential.

## AMQP inbound reliability

```text
RabbitMQ
  -> @RabbitListener
  -> validate envelope/contract
  -> begin context-local transaction
  -> insert inbox key (consumer, eventId)
  -> duplicate: commit + ACK
  -> new: dispatch one local Axon command
  -> durable local outcome + inbox completion
  -> commit + ACK
```

The exact transaction boundary between Spring AMQP, inbox storage, and Axon
command completion must be integration-tested; it is not inferred. A listener
contains no business rule, provider call, projection mutation, or choreography.

Technical errors use bounded retry at 1 s, 10 s, and 60 s, then a per-consumer
DLQ. Business rejection produces a Domain/Integration Event and is ACKed; it is
not poison-message retry. DLQ entries preserve the original body and causal
headers plus failure class, consumer, attempt count, and failed timestamp.
Operator replay republishes the original event with the same `eventId`; inbox
idempotency remains authoritative.

## Outbox atomicity

No code may perform `save` followed by `RabbitTemplate.convertAndSend` as a
business transaction. The source Domain Event is durable first. Its event
processor idempotently creates one outbox row keyed by the source event
identifier. The relay locks pending rows, publishes with mandatory routing and
publisher confirm, and marks them published. A crash after broker confirm but
before marking the row may republish; consumers therefore remain idempotent.

The selected persistent Axon processor must prove one of these guarantees:

1. processor position and outbox insert commit atomically with the selected
   transaction manager; or
2. replay/restart plus the unique source-event key deterministically repairs a
   missing outbox row without creating a semantic duplicate.

Which guarantee Axon 5.3.1 persistence provides is **NEEDS VALIDATION** before
implementation. RabbitMQ is transport, never the source of truth.

## Strict choreography

### Happy path

```text
Transaction: StartCheckout -> TransactionCreated -> OrderReceivedIntegrationEventV1
Inventory:   OrderReceived -> ReserveInventory -> InventoryReservedIntegrationEventV1
Payment:     InventoryReserved -> RequestPayment -> PaymentApprovedIntegrationEventV1
Inventory:   PaymentApproved -> CommitInventory -> InventoryCommittedIntegrationEventV1
Transaction: independently records InventoryReserved, PaymentApproved,
             InventoryCommitted -> TransactionCompletedIntegrationEventV1
```

Payment provider I/O occurs behind `PaymentProvider` after a local
`PaymentRequested` fact and uses a deterministic idempotency key. The provider
result returns as a local command; no event-sourcing handler performs I/O.

### Failure and compensation paths

- `InventoryReservationRejectedV1`: Transaction rejects; Payment has no
  binding for this event and is never invoked.
- `PaymentRejectedV1`: Inventory releases its reservation and Transaction
  rejects independently.
- `InventoryCommitRejectedV1` after approval: Payment starts an idempotent
  refund and Transaction enters `REFUND_PENDING`; `PaymentRefundedV1`
  converges both observable lifecycles to terminal `REFUNDED`.
- `PaymentRefundedV1`: Transaction records compensation completion; Inventory
  records/releases only its own reservation as applicable.
- `TransactionCancelledV1`: Inventory and Payment independently decide whether
  local release/refund is valid.

No handler calls two contexts, emits another context's command, or encodes the
whole transition graph.

## CQRS projections and SSE

| Projection | Owner | Inputs | Queries/subscriptions |
|---|---|---|---|
| `TransactionView` | Transaction | Transaction Domain Events derived from local commands and received outcomes | checkout lookup, workflow compatibility field, `transaction(id)`, `onTransactionUpdated(transactionId)` |
| `CheckoutOperationView` | Transaction | checkout claim/create/reconcile facts | operation-key idempotency and recovery lookup |
| `InventoryReservationView` | Inventory | reserve/reject/commit/release facts | operational/admin lookup only |
| `PaymentView` | Payment | requested/pending/approved/rejected/refunded facts | existing Payment federation query/entity fields |

Projection handlers compare aggregate/event version so an older event cannot
overwrite newer state. Rebuild must produce the same rows as online processing.
`QueryUpdateEmitter` emits only after the Transaction projection commit and
matches both `transactionId` and authenticated owner/capability.

## Public GraphQL/SSE path

```text
Browser or Gateway GraphiQL
  -> Gateway /graphql/stream (OAuth verification, public SSE termination)
  -> Java /graphql/stream (OAuth resource server, orders:read)
  -> Spring GraphQL @SubscriptionMapping(transactionId)
  -> ReactorQueryGateway.subscriptionQuery
  -> initial TransactionView + filtered QueryUpdateEmitter updates
  -> Flux -> SSE -> Gateway -> client

WordPress/WPGraphQL remains a composed commerce data owner; it does not
automatically route or proxy the subscription.
```

This reuses the approved Gateway GraphiQL and SSE proxy instead of claiming
Apollo Federation subscription planning. WordPress remains the composed
commerce data owner and does not host or proxy subscriptions.

## PostgreSQL ownership

One PostgreSQL instance is used locally and one RDS PostgreSQL instance is the
AWS target. Each business schema has a separate migration stream and ideally a
separate least-privilege database role.

| Schema | Tables/views | Owner | Access rule |
|---|---|---|---|
| `transaction` | `checkout_operation`, `transaction_view`, `transaction_inbox`, `transaction_outbox`, optional import checkpoint | Transaction | Transaction adapters only |
| `inventory` | `inventory_reservation_view`, `inventory_operation`, `inventory_inbox`, `inventory_outbox` | Inventory | Inventory adapters only |
| `payment` | `payment_view`, `payment_effect`, `payment_inbox`, `payment_outbox`, `provider_notification_inbox` | Payment | Payment adapters only |
| **NEEDS VALIDATION** | Axon event, token/processor, sequencing, dead-letter, snapshot tables | Axon infrastructure | Determine from the selected Axon 5.3.1 persistence implementation; do not assign to a business context yet |

There are no cross-context queries, joins, foreign keys, JPA relations, or
shared business tables. Every business projection stores opaque foreign
identities only. No production auto-DDL is allowed.

## Migration and cutover constraints

1. Characterize current checkout, GraphQL/SSE, message, and status behavior.
2. Validate and select persistent Axon 5.3.1 infrastructure before creating
   Axon migrations.
3. Introduce context schemas and compatibility projections without enabling a
   second writer.
4. Convert Inventory and Payment independently, then add Transaction.
5. Run old/new read models in shadow mode and compare deterministic fixtures.
6. Choose and test either a restartable legacy importer or an approved clean
   start. The importer never calls WooCommerce, Mercado Pago, or RabbitMQ.
7. Switch Gateway/AMQP routing so exactly one runtime accepts commands.
8. Keep rollback routing and legacy data read-only until reconciliation passes;
   only then remove the Node runtime.

The eventual deployable rename is not on the critical migration path.

## Architecture enforcement

ArchUnit and contract checks must prove:

- dependency direction and no cross-context internal imports;
- no GraphQL, Spring AMQP, provider, WooCommerce, SQL, or repository dependency
  in domain code;
- no class matching a hidden orchestrator or invoking actions in two contexts;
- no cross-schema SQL, JPA association, or foreign key;
- versioned event envelope and causal metadata;
- only verified Axon 5 annotation packages are allowlisted.

## Sources

- [Axon Framework 5.3 reference](https://docs.axoniq.io/axon-framework-reference/5.3/)
- [Axon event-sourced entities](https://docs.axoniq.io/axon-framework-reference/5.3/commands/entities/event-sourced-entity/)
- [Axon Spring integration](https://docs.axoniq.io/axon-framework-reference/5.3/configuration/spring/)
- [Local Axon 5.3.1 reference](../../../../../axon-graphql-posts)
- [Current Java audit](audit-current-java.md)
- [Current Workflow audit](audit-current-workflow.md)
- [Authoritative refactor prompt](/home/kaiosilva/Downloads/PROMPT_PLANO_REFATORACAO_JAVA_AXON5_RABBITMQ.md)
