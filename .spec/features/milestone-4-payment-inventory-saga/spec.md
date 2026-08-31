# Spec: Milestone 4 — Payment, inventory, and saga

> feature: milestone-4-payment-inventory-saga
> status: pronta

## Context

Milestone 3 atomically records a Commerce workflow and an unsent
`checkout.requested` event after WooCommerce creates the commercial order. This
feature publishes that event through RabbitMQ, processes payments in a separate
Java 21/Spring Boot runtime, reserves inventory in WooCommerce, and advances the
Commerce workflow through monotonic states. Every broker delivery is treated as
at least once; inbox records and stable effect keys make duplicates harmless.

## Stories

### US-026 — Platform publishes and consumes events reliably

As the operations owner, I want durable event delivery with bounded retries so
that recoverable failures are retried and terminal failures remain inspectable.

#### AC-041 — Outbox publication waits for broker confirmation

- **Dado** an unsent Commerce outbox event
- **Quando** the publisher routes it to the durable marketplace exchange
- **Então** the row is marked sent only after publisher confirmation and an unconfirmed publish remains eligible for retry

#### AC-042 — Consumer failures have bounded retry and DLQ

- **Dado** a valid event whose consumer repeatedly fails
- **Quando** the configured retry limit is exhausted
- **Então** the message reaches an inspectable dead-letter queue with correlation metadata and without secrets or personal data

### US-027 — Payment processor handles Card and Pix idempotently

As a buyer, I want payment processing to survive duplicate deliveries so that a
checkout causes one payment effect and reaches the expected method-specific state.

#### AC-043 — Card authorization is applied once

- **Dado** duplicate Card payment requests with the same event and operation identifiers
- **Quando** the Java payment processor handles them concurrently or after redelivery
- **Então** one payment effect is recorded and equivalent `payment.authorized` results are published safely

#### AC-044 — Pix code generation is stable and terminal for this milestone

- **Dado** duplicate Pix payment requests for one operation
- **Quando** the Java payment processor generates the payment instruction
- **Então** one stable Pix code is recorded, `payment.pix-generated` is published, and no inventory reservation is requested

#### AC-045 — Payment processor is operable through Nx

- **Dado** the Java 21/Spring Boot Gradle project
- **Quando** the workspace build, test, health, or shutdown paths run
- **Então** Nx exposes the Gradle targets, tests pass, health is observable, and broker consumption stops gracefully before process exit

### US-028 — Inventory reservation is idempotent

As the marketplace, I want approved Card orders to reserve WooCommerce inventory
once so that duplicates cannot decrement stock repeatedly.

#### AC-046 — Stock reservation changes WooCommerce once

- **Dado** duplicate reservation requests for an approved Card order with available stock
- **Quando** the inventory worker processes them
- **Então** WooCommerce stock is decremented once and equivalent `stock.reserved` results are emitted

#### AC-047 — Insufficient stock requests compensation

- **Dado** an approved Card order whose requested quantity is unavailable
- **Quando** inventory reservation is attempted
- **Então** no partial reservation remains and one `stock.reservation-failed` result identifies a safe failure reason

### US-029 — Commerce advances a monotonic choreographed saga

As a buyer, I want the order workflow to converge despite duplicates and
out-of-order messages so that its state never regresses or applies an effect twice.

#### AC-048 — Successful Card journey completes

- **Dado** an order whose Card payment is authorized and stock is reserved
- **Quando** Commerce consumes the saga results, including duplicates or stale events
- **Então** the workflow advances monotonically to `COMPLETED` and emits each next command once

#### AC-049 — Stock failure refunds and cancels

- **Dado** an authorized Card payment followed by a stock reservation failure
- **Quando** the compensation events are processed
- **Então** one refund occurs and the workflow advances through `REFUNDED` to `CANCELLED`

#### AC-050 — Pix journey exposes the generated code

- **Dado** a Pix checkout whose payment instruction was generated
- **Quando** Commerce consumes `payment.pix-generated`
- **Então** the workflow ends at `PIX_GENERATED` with its stable Pix code and without a stock or refund command

### US-030 — Distributed failure recovery is proven

As the operations owner, I want executable crash and duplicate scenarios so that
the at-least-once design is verified rather than assumed.

#### AC-051 — Crash after effect before acknowledgement is harmless

- **Dado** a consumer that commits its local effect and inbox before acknowledging the message
- **Quando** it crashes and RabbitMQ redelivers the same event
- **Então** the inbox suppresses the repeated effect and the delivery can be acknowledged safely

#### AC-052 — Milestone acceptance runs from one workspace command

- **Dado** PostgreSQL, WordPress/WooCommerce, RabbitMQ, Commerce, payment, and inventory services
- **Quando** the Milestone 4 acceptance target runs through Nx
- **Então** successful Card, compensated Card, Pix, duplicate, retry, DLQ, and crash-recovery scenarios all pass

## Out of scope

- Real payment-acquirer capture, Pix confirmation, Pix expiration, and Pix stock reservation.
- GraphQL subscriptions and stream replay, which belong to Milestone 5.
- Apollo MCP, cloud deployment, OpenTelemetry, and a custom terminal UI.
- A general workflow engine, event-sourcing framework, or custom RabbitMQ client.

## Suposições

| ID | Assumption | Status | Resolution |
|---|---|---|---|
| ASM-012 | RabbitMQ deliveries are at least once and duplicates are normal. | confirmada | PRD 04 and RabbitMQ reliability guidance require publisher confirms, manual acknowledgements, and idempotent consumers. |
| ASM-013 | The payment processor uses Java 21, Spring Boot, Gradle, and a dedicated PostgreSQL database. | confirmada | ADR 005 and Roadmap Milestone 4 already accept this runtime and Nx integration. |
| ASM-014 | Pix ends at code generation without reserving inventory in this milestone. | confirmada | The required terminal state is `PIX_GENERATED`; deferring reservation avoids holding stock without confirmed payment and avoids speculative expiration logic. |
| ASM-015 | WooCommerce remains authoritative for stock quantities. | confirmada | PRD 01 assigns inventory reservation/release to WooCommerce and permits only local inbox/reservation metadata. |
| ASM-016 | Broker retry uses native queues, TTL, dead-lettering, confirms, and acknowledgements. | confirmada | These RabbitMQ primitives cover the required bounded retry without adding a delayed-message plugin or custom scheduler. |

## Perguntas em aberto

None.
