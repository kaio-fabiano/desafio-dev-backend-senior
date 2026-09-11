# Design: Refactor checkout operation flow

## Baseline and ownership

- Baseline: current `main` worktree after preserving its pre-existing dirty
  GraphQL edits. No checkout executor is active.
- Bounded context: Transaction owns checkout-operation state and Transaction.
- Use case: start or observe an idempotent checkout.
- Aggregates: reuse `Transaction`; do not invent an Order aggregate because
  WooCommerce owns the commercial order. `CheckoutOperation` is an explicit
  durable application consistency record, not a lease.
- Consistency: Axon routing sequences one operation inside a command-bus
  instance; PostgreSQL uniqueness and conditional state transitions close the
  cross-instance race; provider idempotency and Woo reconciliation protect
  their external boundaries.
- Ports: `CheckoutOperationRepository`, `WooCommerceOrderPort`, asynchronous
  Transaction command dispatch, and a checkout update publisher.

## Verified library behavior

The installed dependency is Axon Framework 5.3.1. Its
`CommandSequencingInterceptor` and `RoutingKeySequencingPolicy.INSTANCE` are
available. Spring Boot autoconfiguration discovers a
`MessageHandlerInterceptor<CommandMessage>` bean. The interceptor stores active
sequences in an in-memory `ConcurrentHashMap`; it is not a distributed lock.
The design therefore never presents it as the cross-replica defense.

## Exact target types

Keep the current checkout package for this behavioral refactor; package moves
belong to another draft.

1. Add `CheckoutOperationId` as a framework-free value object. `from(subject,
   operationKey)` validates non-blank values, builds an unambiguous length-
   prefixed UTF-8 string, and returns a name-based UUID string. No random UUID
   is allowed for checkout or Transaction identity.
2. Extend `CheckoutCommand` with an `operationId` component computed by its
   public convenience constructor. Annotate it with Axon 5.3.1's existing
   command metadata and `routingKey = "operationId"`; do not invent an Axon API.
3. Preserve `CheckoutCommandHash.hash(command)` independently. Session headers
   are not part of the semantic hash; payment intent fields remain part of it.
4. Replace `CheckoutResult(transactionId, wooOrderId)` with the operation-shaped
   result needed by GraphQL: operation ID, status, order ID, payment ID, and
   nullable safe error reason. If compatibility requires the old accessors,
   derive them without introducing a second result type.
5. Keep detailed durable states because they encode recovery:
   `PENDING_WOO`, `WOO_CREATION_REQUESTED`, `WOO_CONFIRMED`, `COMPLETED`, and
   `FAILED` only if a terminal failure is actually recorded. Remove
   `CREATING_WOO` only by renaming it in migration-safe form.

## Repository contract and database algorithm

Replace `claim`, `Claim`, `ClaimRequest`, owner parameters, lease parameters,
`release`, and lease renewal with these semantics using project naming:

```text
createOrLoad(command facts) -> Operation
markWooCreationRequested(operationId) -> boolean
recordWooOrder(operationId, order) -> Operation
complete(operationId) -> Operation
fail(operationId, safeReason) -> Operation       # only for terminal failures
find(operationId, subject) -> Optional<Operation>
```

`createOrLoad` runs in a short PostgreSQL transaction:

```text
INSERT checkout_operation(
  operation_id = deterministic CheckoutOperationId,
  subject, operation_key, command_hash, woo_reference,
  payment_id = "payment:" + operation_id,
  status = PENDING_WOO
)

on unique violation:
  SELECT by subject + operation_key
  validate operation_id, command_hash, and woo_reference
  return winner
```

The Flyway migration must provide the real constraint
`UNIQUE(subject, operation_key)`. Remove global uniqueness from
`operation_key`. Keep deterministic `operation_id` as primary key and retain
unique `woo_reference` and `woo_order_id`. Remove `owner_token`, `lease_until`,
their equality check, and the lease index.

`markWooCreationRequested` is one atomic conditional update:

```sql
update transaction.checkout_operation
set status = 'WOO_CREATION_REQUESTED', updated_at = :now
where operation_id = :id and status = 'PENDING_WOO'
```

The returned update count decides whether this invocation may call create.
This is a monotonic business transition, not a lock. A zero count reloads and
returns the existing operation; it never grants ownership.

## Request flow

`CheckoutCommandHandler` remains the Axon entry point and calls the refactored
`CheckoutService`. The local command bus registers exactly one
`CommandSequencingInterceptor<>(RoutingKeySequencingPolicy.INSTANCE)` bean.

```text
GraphQL mutation
  -> deterministic CheckoutCommand.operationId
  -> Axon command routing key = operationId
  -> repository.createOrLoad and commandHash validation
  -> terminal operation: return persisted result
  -> PENDING_WOO and conditional transition won:
       commit WOO_CREATION_REQUESTED
       call Woo create synchronously with request-scoped cart credentials
       record WOO_CONFIRMED
       dispatch StartTransaction asynchronously
       return current operation immediately after dispatch
  -> WOO_CREATION_REQUESTED:
       perform one bounded findByReference, never create
       found: record and dispatch deterministic StartTransaction
       absent: keep PROCESSING/requested and surface the existing ambiguous state
  -> WOO_CONFIRMED:
       redispatch deterministic StartTransaction asynchronously and return
  -> duplicate while another call is active:
       conditional update loses; return or reconcile existing operation;
       never wait, poll, sleep, or create
```

The first Woo create is intentionally synchronous because its cart credentials
remain request-scoped and are not persisted. This was explicitly approved.
Reconciliation needs only service authentication and the stored reference.

Change `TransactionCommands.start` to return `CompletableFuture<String>` and
use Axon's non-blocking `CommandGateway.send`. Attach completion handling that
marks the operation `COMPLETED` and emits an update, or records a safe terminal
failure only when retry cannot be valid. If the process dies after Transaction
creation but before completion recording, the next request redispatches the
same deterministic `StartTransaction`; the existing handler already validates
and returns an existing matching entity.

Use `CheckoutOperationId.value()` as `StartTransaction.transactionId`. Keep the
existing payment operation key derivation (`operationKey + ":payment"`) and
payment identifier (`payment:` plus transaction/operation ID), so one checkout
maps to one internal Transaction and Payment.

## WooCommerce uncertain-result protocol

The permitted state dispatch is fixed:

| State | Meaning | Next action | Retry |
|---|---|---|---|
| `PENDING_WOO` | no create started | conditional commit to requested | winner may create once |
| `WOO_CREATION_REQUESTED` | create may have happened | `findByReference` only | found confirms; missing remains ambiguous |
| `WOO_CONFIRMED` | exact Woo order persisted | async deterministic Transaction command | never create |
| `COMPLETED` | Transaction start accepted | return stored result | no Woo call |
| `FAILED`, if retained | explicit terminal failure | none unless specified | never converts ambiguity into create |

Keep `CheckoutCommandHash.wooReference(subject, operationKey)` byte-for-byte
compatible. It is already deterministic and externally persisted. Do not
replace it merely because `CheckoutOperationId` also derives from the pair.

`WooCommerceGraphQlOrderAdapter.createOrFind` is explicitly non-atomic:
lookup, one checkout mutation, then reconciliation if the response lacks an
ID. The WordPress plugin only enables exact metadata lookup. Update ADR 006 to
state this limitation; do not modify the plugin.

## GraphQL and SSE

Reuse the existing `/graphql` mutation and GraphQL-over-SSE transport.

- Change `startCheckout` to return `CheckoutOperation`, not an artificial
  started `Order`. The response contains `id`, `operationKey`, `status`,
  `orderId`, `paymentId`, and `errorReason`.
- Existing `checkout(id)` remains owner-scoped and returns the same shape.
- Add `checkoutUpdated(operationId: ID!): CheckoutOperation!` to the existing
  `Subscription` type and `TransactionSubscriptionController`; do not create a
  second SSE server.
- Add an application `CheckoutOperationUpdates` port and an Axon/Spring query
  update emitter adapter. Emit after committed operation transitions. On
  reconnect, the normal query returns the durable latest state.
- Mutation handling must not use `boundedElastic` to conceal blocking waits.
  The approved first Woo HTTP call may use the existing HTTP boundary; no loop
  or wait for another request is allowed.

## Payment idempotency

Do not rewrite the separate provider-effect recovery feature. Verify and retain
the existing operation-derived Payment command key all the way to
`MercadoPagoPaymentProvider`. Its `X-Idempotency-Key` must be identical when a
provider request is retried after a crash. The test captures two provider calls
around a simulated lost local result and asserts the same header and one
logical provider payment.

## Transactional outbox

Reuse existing AMQP tables, `JpaOutboxStore`, `OutboxRelay`, publisher confirms,
row claims, retries, and `ReliableAmqpConsumer`. RabbitMQ remains at-least-once.

The current `TransactionEventHandler` calls `JpaTransactionViewStore` and
`JpaTransactionOutbox`, each with its own `REQUIRES_NEW` transaction. Correct
only this atomicity gap:

1. Add an infrastructure `TransactionalTransactionEventHandler` with
   `@EventHandler` and Spring `@Transactional`.
2. It delegates the existing projection and selective integration-event logic
   inside one transaction.
3. Change the two delegated JPA stores from `REQUIRES_NEW` to joining the
   ambient transaction (`REQUIRED`), while their direct calls still start a
   transaction when none exists.
4. Register only the transactional handler bean; do not register the old
   application handler separately.
5. Keep the rule `event.version() == 1` for the explicit
   `transaction.order-received.v1` integration contract. Do not publish every
   Axon event.

Integration tests make Rabbit publishing fail, then prove Transaction view and
outbox row committed together and the existing relay publishes later. Existing
inbox tests prove duplicate delivery is harmless. Outbox row leases remain
allowed because they coordinate delivery, not checkout business ownership.

## Tests: exact executable matrix

Extend existing fixtures instead of creating parallel harnesses.

| Test owner | Required proof |
|---|---|
| `CheckoutServiceTest` | first call; completed retry; different payload conflict; same-operation concurrency; different-operation parallelism; async Transaction dispatch; no waits; Woo normal, crash, timeout, missing reconciliation, confirmed retry, deterministic reference |
| `JpaTransactionPersistenceTest` | subject-scoped unique race and loser reload; conditional requested transition has one winner; requested state visible in an independent transaction before fake create; schema has no lease columns/index |
| `TransactionAxonTest` | all checkout commands carry one routing key; same key max concurrency 1 locally; different keys overlap; deterministic StartTransaction replays safely |
| `WooCommerceGraphQlOrderAdapterTest` | exact find-then-create sequence and lookup-only reconciliation |
| `MercadoPagoPaymentProviderTest` plus existing effect test | crash retry sends identical idempotency header and yields one logical payment |
| `TransactionSubscriptionSseTest` | owner-scoped `PROCESSING -> COMPLETED` or failure update through existing SSE endpoint |
| `RabbitMqBoundaryIntegrationTest` and persistence test | broker unavailable leaves outbox pending; later relay publishes; redelivery remains idempotent; state and outbox share rollback/commit |
| existing Java-to-TAP bridge | reads all final JUnit XML reports and carries every criterion tag AC-333 through AC-350 |

Concurrency tests use barriers/latches and bounded future timeouts, never sleep.
The distributed race test uses two repository/application instances sharing one
PostgreSQL container, not `synchronized` or an in-memory repository.

## Removal checklist

Before deletion, `rg` every use and replace only its guarantee:

```text
Claim, ClaimRequest              -> createOrLoad result + DB uniqueness
ownerToken, owner                -> atomic monotonic state transition
LEASE, leaseUntil, lease index   -> removed; no business lock replacement
waitTimeout, POLL, sleep         -> mutation returns current operation
CheckoutBusyException            -> no synchronous busy state
release/renew                    -> durable state remains for retry
CREATING_WOO                      -> WOO_CREATION_REQUESTED semantics retained
```

Final structural searches must find none of these checkout mechanisms and no
new distributed lock.

## Observability

Use existing logging conventions. Log operation ID at GraphQL, Axon, Woo,
Transaction, Payment, outbox, and Rabbit boundaries, plus applicable subject,
operation key, order ID, payment ID, message ID, and event type. Never log
session cookies, cart/session tokens, bearer or authorization headers, provider
tokens, card data, site tokens, or secrets.

## Verification

Each production task records Red, Green, and Refactor evidence. Final commands:

```bash
pnpm exec nx run payment-federation:test --skip-nx-cache
pnpm exec nx run payment-federation:build --skip-nx-cache
pnpm exec nx run payment-federation:lint --skip-nx-cache
node .agents/skills/onp-spec-driven/scripts/onp-spec.mjs verify refactor-checkout-operation-flow
node .agents/skills/onp-spec-driven/scripts/onp-spec.mjs audit --ci
```

Docker or Testcontainers failure is infrastructure failure, not permission to
skip tests or substitute H2 for distributed PostgreSQL/RabbitMQ evidence.
