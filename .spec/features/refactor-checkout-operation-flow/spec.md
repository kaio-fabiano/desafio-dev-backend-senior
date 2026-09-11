# Spec: Refactor checkout operation flow

> feature: refactor-checkout-operation-flow
> status: rascunho

## Context

Payment Federation still coordinates checkout with a polling loop, sleeps, a
30-second database lease, random ownership tokens, and synchronous waiting for
another request. The operation key is globally unique instead of scoped by
subject, the transaction identifier is random, the GraphQL mutation waits for
WooCommerce and Transaction creation, and the transaction projection and
RabbitMQ outbox are written in separate transactions.

The replacement uses a deterministic checkout operation identity, Axon command
routing and sequencing, PostgreSQL uniqueness, asynchronous operation state,
GraphQL SSE, provider idempotency, and the existing reliable AMQP outbox. It
must also preserve the independent WooCommerce uncertain-result protocol:
persist an attempted-create state before the external call and reconcile by a
stable reference after crash, timeout, or redelivery.

## User stories

### US-152 — Start one asynchronous idempotent checkout

As a buyer, I want retries of the same checkout intent to identify one durable
operation without waiting for another request to finish.

#### AC-333 — Derive one operation identity and preserve command hashing

- **Dado** a validated checkout command
- **Quando** its identity and semantic hash are calculated repeatedly or on another instance
- **Então** the same subject and operation key produce the same non-random `CheckoutOperationId`, while `CheckoutCommandHash` independently produces the same hash for the same payload

#### AC-334 — Reject reuse with a different semantic payload

- **Dado** an existing operation for one subject and operation key
- **Quando** a request reuses that pair with a different command hash
- **Então** checkout returns the project-standard explicit idempotency conflict and performs no additional WooCommerce, Transaction, Payment, or RabbitMQ side effect

#### AC-335 — Resolve the PostgreSQL creation race

- **Dado** at least two application instances concurrently creating the same subject and operation key
- **Quando** both observe no existing row and attempt insertion
- **Então** `UNIQUE(subject, operation_key)` permits one row, the loser reloads and validates the winner including command hash, and neither request becomes an internal server error

#### AC-336 — Sequence one operation without global serialization

- **Dado** concurrent commands for operation A and independent operations B and C
- **Quando** Axon dispatches them
- **Então** commands sharing `CheckoutOperationId` use one routing or consistency key and execute sequentially, while different identifiers may execute concurrently

#### AC-337 — Return operation state without synchronous checkout waiting

- **Dado** a new, processing, completed, or failed checkout operation
- **Quando** the GraphQL mutation is called
- **Então** it returns the deterministic operation identifier and current durable status promptly, reuses existing results, and contains no polling, sleep, lease acquisition, or wait for another checkout request

### US-153 — Recover external checkout effects safely

As an operator, I want every external effect to have its own durable idempotency
or reconciliation guarantee, so that process failure cannot duplicate money or
commercial orders.

#### AC-338 — Use one payment-provider idempotency key after crash

- **Dado** the provider created a payment and the Java process failed before recording completion
- **Quando** the payment effect is retried
- **Então** the provider receives the same operation-derived idempotency key and returns the same logical payment rather than creating another

#### AC-339 — Create at most one internal Transaction for one checkout

- **Dado** repeated or redelivered completion of one WooCommerce order step
- **Quando** Transaction creation is dispatched
- **Então** the deterministic checkout or transaction identity causes the existing Transaction to be reused and no second logical order workflow is created

#### AC-340 — Commit WooCommerce creation-requested before create

- **Dado** an operation for which no WooCommerce create was attempted
- **Quando** checkout reaches the commercial-order effect
- **Então** a durable creation-requested state commits and is visible from an independent PostgreSQL transaction before WooCommerce create begins

#### AC-341 — Reconcile an unknown WooCommerce outcome without blind create

- **Dado** WooCommerce may have created the order but its response or subsequent local recording was lost
- **Quando** the operation is retried, restarted, or redelivered
- **Então** checkout calls only `findByReference`, records the matching order when found, and otherwise retains the requested state and reports the existing ambiguous-result behavior

#### AC-342 — Keep one deterministic WooCommerce reference

- **Dado** the same logical checkout across first attempt, retry, restart, and reconciliation
- **Quando** a WooCommerce request is constructed
- **Então** every request uses the same stable reference and executable evidence identifies `createOrFind` as non-atomic find-then-create

### US-154 — Observe checkout completion over GraphQL SSE

As a client, I want to follow one checkout operation asynchronously, so that
the mutation does not need to remain open until all side effects finish.

#### AC-343 — Persist queryable operation outcomes

- **Dado** checkout processing starts, completes, or fails
- **Quando** its projection is queried by the authenticated owner
- **Então** it exposes operation ID, status, Woo order or internal order ID, payment ID when available, and a non-sensitive failure reason when applicable

#### AC-344 — Emit operation updates over the existing SSE implementation

- **Dado** a client subscribed to one owned checkout operation before processing finishes
- **Quando** its durable state moves from processing to completed or failed
- **Então** the existing GraphQL-over-SSE infrastructure emits the matching update once per version without exposing another subject's operation

### US-155 — Deliver integration events reliably

As an operator, I want a committed checkout or Transaction change to retain its
RabbitMQ integration event while the broker is unavailable.

#### AC-345 — Commit local state and integration outbox atomically

- **Dado** a state transition that contractually emits a RabbitMQ integration event
- **Quando** PostgreSQL commits while RabbitMQ is unavailable or the process dies
- **Então** the application state and outbox row commit in one PostgreSQL transaction and the message remains pending for later publication

#### AC-346 — Publish at least once from multiple instances

- **Dado** multiple outbox relays and pending rows
- **Quando** they claim, publish with confirms, retry failures, and mark success
- **Então** each row remains recoverable without indefinite blocking, RabbitMQ is never used as a checkout lock, and duplicate publication remains permitted by the at-least-once contract

#### AC-347 — Make redelivered integration messages harmless

- **Dado** the same integration event is delivered twice
- **Quando** an existing consumer handles both deliveries
- **Então** its durable inbox or domain identity prevents a duplicate business effect and acknowledges only durable handling

### US-156 — Remove obsolete concurrency machinery safely

As a maintainer, I want checkout concurrency expressed by durable identities and
states, so that no lease-based implementation remains disguised in another class.

#### AC-348 — Remove checkout polling, leases, and ownership

- **Dado** the replacement tests are green
- **Quando** obsolete checkout artifacts are inspected
- **Então** `Claim`, `ClaimRequest`, owner tokens, checkout lease fields and indexes, wait timeouts, `CheckoutBusyException`, polling loops, sleeps, renew/release logic, and equivalent in-memory or broker locks are absent from the checkout flow

#### AC-349 — Preserve meaningful operation states and retry behavior

- **Dado** every final checkout operation state
- **Quando** its semantics are audited
- **Então** each state documents business meaning, possible completed side effects, allowed next transition, retry behavior, and retains a distinct durable WooCommerce uncertain-result state

#### AC-350 — Correlate safely across every boundary

- **Dado** one checkout crosses GraphQL, Axon, WooCommerce, Transaction, Payment, outbox, and RabbitMQ
- **Quando** structured logs are emitted
- **Então** operation ID plus applicable subject, operation key, order ID, payment ID, message ID, and event type provide correlation without tokens, authorization headers, payment secrets, or sensitive payment data

## Out of scope

- Adding Redis, advisory locks, RabbitMQ exclusivity, per-checkout queues,
  `synchronized`, `ReentrantLock`, or any replacement distributed lock.
- Claiming distributed exactly-once delivery.
- Publishing every Axon domain event to RabbitMQ; only existing or explicitly
  mapped integration contracts enter the outbox.
- Replacing Axon, Spring GraphQL, GraphQL SSE, PostgreSQL, RabbitMQ, Flyway,
  WooGraphQL, or Mercado Pago.
- Adding a WordPress idempotent write endpoint. The current plugin enables
  lookup only; atomic WordPress idempotency requires a separate feature.
- Reorganizing packages under the separate
  `organize-payment-federation-structure` draft.
- Modifying payment-effect recovery owned by
  `recover-payment-provider-effects`, except consuming its verified contract.

## Suposições

| ID | Assumption | Status | Resolution |
|---|---|---|---|
| ASM-123 | No checkout refactor executor is currently active; the current main worktree is the implementation baseline. | confirmada | Process, worktree, source, and Git inspection on 2026-09-11 showed no running executor and the legacy checkout flow remains present. |
| ASM-124 | Axon Framework 5.3.1 local command sequencing is JVM-local and cannot alone prove cross-instance exclusion. | confirmada | The installed `CommandSequencingInterceptor` source uses an in-memory `ConcurrentHashMap`; PostgreSQL uniqueness, Axon event consistency, and external-effect protocols remain mandatory distributed defenses. |
| ASM-125 | The existing WooCommerce boundary has no atomic server-side idempotency guarantee. | confirmada | Adapter code is find-then-create and the project-owned WordPress plugin only registers metadata search hooks. |
| ASM-126 | Existing AMQP outbox, relay, publisher confirms, row claims, retries, and inbox deduplication should be reused. | confirmada | Repository inspection found `JpaOutboxStore`, `OutboxRelay`, `ConfirmedAmqpPublisher`, durable AMQP entities, and `ReliableAmqpConsumer`; only atomic coupling to the owning local state requires correction and proof. |
| ASM-127 | Planning uses the capable current model; all implementation tasks run sequentially with `gpt-5.6-luna` and low effort. | confirmada | The owner explicitly selected expensive deterministic planning followed by one continuous cheap execution. |

## Perguntas em aberto

| ID | Question | Status | Answer |
|---|---|---|---|
| Q-028 | How must checkout handle request-scoped WooCommerce cart credentials while removing synchronous waiting between duplicate requests? | respondida | Keep only the first Woo create synchronous with the initiating request. Duplicate requests return or reconcile the durable operation without waiting or creating; Transaction and later processing use non-blocking deterministic Axon commands. Do not persist buyer cookies or Woo session credentials. |
