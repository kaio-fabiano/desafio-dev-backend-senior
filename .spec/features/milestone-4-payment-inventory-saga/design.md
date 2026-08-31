# Design: Milestone 4 — Payment, inventory, and saga

## Smallest distributed slice

Commerce remains the saga participant that owns `OrderWorkflow`; it is not a
central workflow engine. RabbitMQ routes facts and commands. Payment owns one
payment effect plus its inbox/outbox in a dedicated PostgreSQL database. The
inventory worker owns only delivery deduplication and stable reservation
references; WooCommerce remains authoritative for stock.

## Event and transaction boundaries

1. Commerce publishes its existing outbox event and marks it sent only after a
   RabbitMQ publisher confirm.
2. A participant handles a delivery inside one local transaction: claim the
   `eventId` inbox key, apply the local effect, and record its outgoing event.
3. A participant acknowledges only after commit. A crash before acknowledgement
   causes redelivery, which the inbox treats as a successful no-op.
4. Participant outboxes use the same confirmed-publication rule. Event identity
   changes for each new fact; correlation remains the checkout operation key.
5. Finite native retry queues dead-letter terminal failures. DLQ payloads retain
   event and correlation identifiers but no credentials or buyer data.

## Card transition path

```text
CREATED -> PAYMENT_PENDING -> PAYMENT_AUTHORIZED -> STOCK_PENDING -> COMPLETED
                                                   -> STOCK_FAILED
STOCK_FAILED -> REFUND_PENDING -> REFUNDED -> CANCELLED
```

Every accepted transition, inbox record, and next command outbox row is written
atomically in Commerce. Duplicate events are no-ops. Events that would regress a
workflow are acknowledged and recorded as ignored rather than changing state.

## Pix transition path

```text
CREATED -> PIX_PENDING -> PIX_GENERATED
```

`PIX_GENERATED` is terminal for Milestone 4 and stores the stable code. Inventory
is not reserved because code generation is not payment confirmation. Confirmation,
expiration, and any later reservation policy require a future product decision.

## Runtime boundary

The payment processor is a minimal Spring Boot/Java 21 Gradle application with
health and graceful shutdown. `@nx/gradle` exposes its native Gradle tasks in the
same Nx graph; no wrapper task runner or custom TUI is introduced. The stock
worker reuses the repository's TypeScript/Nx/WooCommerce infrastructure rather
than introducing a third runtime or framework.

## Test strategy

Pure transition and payment invariants use small unit tests. PostgreSQL tests
prove unique inbox/effect keys and atomic writes. RabbitMQ tests prove confirms,
redelivery, retry, DLQ, and acknowledgement timing. One acceptance target composes
the real infrastructure and exercises Card success, compensated Card, and Pix.
