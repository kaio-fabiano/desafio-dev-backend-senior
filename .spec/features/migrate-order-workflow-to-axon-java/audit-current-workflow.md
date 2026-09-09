# Current Workflow and Integration Contract Audit

> Task: T-241
>
> Scope: `apps/order-workflow-subgraph`, `apps/gateway`, `apps/identity-subgraph`, `apps/wordpress-integration`, relevant shared Nest libraries, `libs/contracts`, `compose.yaml`, and related tests
>
> Evidence date: 2026-09-09
>
> Status: documentation-only audit; no production code, dependency, or configuration was changed

## 1. Audit basis and terminology

The following files are authoritative for the target constraints:

- `/home/kaiosilva/Downloads/PROMPT_PLANO_REFATORACAO_JAVA_AXON5_RABBITMQ.md`
- `/home/kaiosilva/Downloads/TESTING_REQUIREMENTS.md`
- `/home/kaiosilva/Downloads/README_REFACTOR_PLAN_FILES.md`

This report records only behavior supported by repository evidence. `KEEP`, `REFACTOR`, `MOVE`, `SPLIT`, `REMOVE`, and `CREATE` describe the migration action, not an implementation performed by this task. Items that cannot be established from this checkout are marked **NEEDS VALIDATION**.

All paths are repository-relative. After a full path establishes a component, shortened source references such as `order-saga.ts:72-208` resolve under `apps/order-workflow-subgraph/src/`; gateway, identity, contract, Compose, and WordPress references retain their explicit repository path.

## 2. Executive finding

The Node Order Workflow is not a thin transaction boundary. It currently owns checkout leasing and reconciliation, creates the WooCommerce order, persists a complete cross-context workflow state machine, receives Payment and Inventory events, chooses the next cross-context action, stores inbox/outbox records, publishes AMQP messages, and serves the order subscription. The central `OrderSaga` therefore violates the mandatory choreographed-saga constraint even though its inputs and outputs travel through RabbitMQ.

Useful behavior already exists and should be preserved through characterization: durable checkout idempotency, WooCommerce reconciliation by an operation reference, atomic local workflow/outbox writes, inbox deduplication, publisher confirms, bounded AMQP retry and DLQ routing, owner-scoped replayable subscriptions, OAuth resource-server checks, and an SSE proxy at the gateway. These are implementation inputs, not proof that the target Axon 5 design already exists.

The largest migration gaps are:

1. payment-first centrally coordinated flow instead of `OrderReceived -> Inventory -> Payment` choreography;
2. shared domain/integration message shapes with incomplete causal metadata;
3. the Workflow database uses unqualified tables in the default PostgreSQL schema rather than the required `transaction`, `inventory`, and `payment` ownership boundaries;
4. SSE uses a custom PostgreSQL `LISTEN/NOTIFY` plus in-memory broker, not the required Axon subscription-query flow;
5. WordPress publishes queries/mutations only; the required WordPress/GraphiQL-to-Java subscription path does not exist;
6. payment-provider fields are accepted and persisted by Order Workflow before crossing RabbitMQ.

## 3. Current component inventory and disposition

| Current component | Evidence | Current responsibility | Action | Reason |
|---|---|---|---|---|
| `CheckoutService` | `apps/order-workflow-subgraph/src/checkout/checkout.service.ts:39-160` | Validates checkout, claims idempotency lease, calls WooCommerce, derives cart amount/items, creates workflow and enqueues payment | **SPLIT** | Keep transaction intake and idempotency in Transaction; move Woo ACL concerns to an adapter; remove payment-aware orchestration from this use case. |
| `MikroOrmCheckoutRepository` | `apps/order-workflow-subgraph/src/checkout/checkout.repository.ts:46-153` | PostgreSQL lease, workflow creation, atomic callback/outbox write | **REFACTOR** | Preserve concurrency semantics while moving persistence to the Transaction schema and Java ports/adapters. |
| `checkoutCommandHash` / `checkoutWooReference` | `apps/order-workflow-subgraph/src/checkout/command-hash.ts:11-52` | Deterministic canonical hash and external operation reference | **KEEP** | These are stable characterization rules; reimplement as Java value-object/domain/application behavior with identical fixtures. |
| `WooCheckoutPort` | `apps/order-workflow-subgraph/src/checkout/woo-checkout.port.ts:5-34` | Isolates WooCommerce transport types from the service | **KEEP** | It is the correct inward-facing boundary concept; rename/model it as a Java ACL port without Woo DTO leakage. |
| `createWooCheckoutAdapter` | `apps/order-workflow-subgraph/src/checkout/woo-checkout.adapter.ts:26-200` | Reads cart, creates order, performs service login and reconciliation over WPGraphQL | **MOVE** | Move to Java infrastructure behind the Transaction ACL port; preserve exact external-reference reconciliation. |
| `OrderSaga` | `apps/order-workflow-subgraph/src/saga/order-saga.ts:72-208` | Holds the full state machine and selects Inventory/Payment commands | **REMOVE** | It is the prohibited hidden orchestrator/process manager. Replace with independent local reactions inside Transaction, Inventory, and Payment. |
| `OrderEventConsumer` | `apps/order-workflow-subgraph/src/saga/order-event.consumer.ts:26-86` | Atomically claims inbox, locks workflow, runs central saga, persists transition, then ACKs | **SPLIT** | Preserve the inbox/transaction pattern, but each bounded context must consume only relevant integration events and decide only its local action. |
| `MikroOrmOrderSagaRepository` | `apps/order-workflow-subgraph/src/saga/order-saga.repository.ts:29-120` | Locks workflow, mutates central state, creates next cross-context command | **REMOVE** | The repository encodes orchestration. Transaction projections and per-context event-sourced models replace it. |
| `MikroOrmInboxRepository` | `apps/order-workflow-subgraph/src/inbox/inbox.repository.ts:7-53` | `event_id` deduplication in the same local transaction | **MOVE** | Recreate an owned inbox per consuming bounded context/schema. Do not share one global inbox. |
| `MikroOrmOutboxRepository` | `apps/order-workflow-subgraph/src/outbox/outbox.repository.ts:21-85` | Stores integration work atomically and claims unsent rows | **MOVE** | Recreate an outbox per producing bounded context/schema with a versioned envelope. |
| `OutboxPublisher` | `apps/order-workflow-subgraph/src/outbox/outbox.publisher.ts:28-87` | Polls rows, maps envelope, publishes and marks sent | **REFACTOR** | Preserve at-least-once semantics, but use Spring AMQP and the approved metadata contract. |
| RabbitMQ runtime | `apps/order-workflow-subgraph/src/messaging/rabbitmq.ts:5-367` | Declares topic/retry/DLX topology, confirms publish, ACK/retry/DLQ | **REFACTOR** | Re-express through Spring AMQP configuration/listeners; retain bounded retries and mandatory/confirmed publication behavior. |
| Runtime wiring | `apps/order-workflow-subgraph/src/messaging/order-workflow-messaging.runtime.ts:23-149` | Opens three AMQP connections, owns central consumer and 100 ms outbox polling | **REMOVE** | Spring lifecycle/configuration replaces manual runtime wiring; consumers move to bounded-context inbound adapters. |
| PostgreSQL event relay | `apps/order-workflow-subgraph/src/order-events/postgres/postgres-order-event.relay.ts:12-109` | `LISTEN/NOTIFY` cross-replica wake-up and in-memory delivery | **REMOVE** | Target subscription updates must use Axon event handler, `QueryUpdateEmitter`, subscription query, and Reactor `Flux`. |
| `OrderEventsSubscription` / broker | `apps/order-workflow-subgraph/src/order-events/order-events.subscription.ts:38-179`; `order-event-broker.ts:19-66` | Owner/key filtering, replay ordering, heartbeat, timeout and backpressure | **REFACTOR** | Preserve observable filtering/lifecycle behavior; replace custom broker/iterator with Axon 5 subscription queries and Spring GraphQL SSE. |
| Order Workflow GraphQL resolvers | `apps/order-workflow-subgraph/src/graphql/order-workflow.resolver.ts:36-89` | Mutation/query/entity field/subscription boundary with scopes | **MOVE** | Port the public contract to Spring GraphQL controllers; controllers must dispatch commands/queries only. |
| `OrderWorkflowOperationsService` | `apps/order-workflow-subgraph/src/graphql/order-workflow-operations.service.ts:20-77` | Calls checkout and queries MikroORM entities directly | **SPLIT** | Separate command and query application handlers/read models; do not return persistence entities. |
| Gateway federation | `libs/gateway/nest/src/federation/gateway-federation.configuration.ts:28-100` | Locally composes four subgraphs and assigns bearer/session capabilities | **KEEP** | Java replaces the `order-workflow`/payment implementation endpoints while the gateway remains the public composition edge. |
| Gateway SSE proxy | `apps/gateway/src/app.module.ts:25-49`; `apps/gateway/src/subscriptions/order-workflow-subscription.client.ts:12-48` | Terminates public `/graphql/stream` and delegates to Order Workflow SSE | **REFACTOR** | Keep a single public SSE owner if composition cannot route subscriptions natively; point it to the Java subscription endpoint and prove the protocol. |
| Identity/OAuth issuer | `libs/identity/nest/src/oauth-issuer/oauth-issuer.module.ts:12-30` | Owns OAuth client provisioning on Better Auth | **KEEP** | Java services remain OAuth resource servers; identity ownership does not migrate. |
| Shared OAuth resource verification | `apps/order-workflow-subgraph/src/graphql/order-workflow-graphql.module.ts:43-79` | Configures issuer/JWKS/audience and global field guard | **MOVE** | Reimplement equivalent audience/scope enforcement at Java GraphQL and SSE boundaries without moving issuer ownership. |
| WordPress reconciliation plugin | `apps/wordpress-integration/plugins/order-workflow-reconciliation/order-workflow-reconciliation.php:25-103` | Declares HPOS compatibility and adds the operation-reference meta key to native search | **KEEP** | It is a minimal HPOS-compatible boundary and contains no workflow logic or write endpoint. |
| Shared event JSON Schemas | `libs/contracts/events/*.schema.json` | Defines current AMQP envelope and event payloads | **REFACTOR** | Preserve compatible V1 semantics where possible, add required causal/aggregate identifiers, and validate producer/consumer contracts. |
| Shared GraphQL SDL | `libs/contracts/graphql/order-workflow/schema.graphql:8-77` | Public federation contract for checkout, workflow, and `orderEvents` | **REFACTOR** | Preserve compatibility during migration, then introduce the approved transaction read model and `transactionId`-filtered subscription. |

## 4. Current checkout and idempotency behavior

### 4.1 Observed sequence

1. GraphQL `startCheckout` requires `cart:write` and delegates the authenticated subject, input, and WooCommerce session (`order-workflow.resolver.ts:43-51`).
2. `CheckoutService` validates required fields and CARD/PIX field combinations (`checkout.service.ts:163-195`).
3. A SHA-256 hash covers payment method, payer email, provider token, and method id; the Woo reference hashes subject plus operation key (`command-hash.ts:32-52`).
4. PostgreSQL atomically inserts or reacquires an expired 30-second lease. The database now treats `operation_key` as globally unique (`checkout.repository.ts:49-84`; `Migration202609010004.ts:5-10`).
5. A reused key with another subject or command hash fails with `CHECKOUT_IDEMPOTENCY_CONFLICT`; a completed operation returns the original order (`checkout.service.ts:61-76`).
6. The owner calls WooGraphQL `findByReference` then `checkout`, using `_order_workflow_operation_reference`; an ambiguous reference fails closed (`woo-checkout.adapter.ts:93-182`).
7. Workflow state and the first outbox row are written in one PostgreSQL transaction (`checkout.repository.ts:109-152`).

### 4.2 Migration invariants

- **KEEP:** same operation key plus same semantic command returns the same internal transaction and Woo order.
- **KEEP:** same operation key plus different subject or command is rejected.
- **KEEP:** only one caller owns external order creation; expired leases can be reconciled without a second Woo order.
- **KEEP:** local Transaction state and its integration outbox append commit atomically.
- **REFACTOR:** a busy claimant polls every 50 ms indefinitely (`checkout.service.ts:53-77`). The Java design needs a bounded timeout/cancellation outcome.
- **REFACTOR:** provider token and payment method id participate in Order Workflow state flow and are persisted in the outbox payload (`checkout.service.ts:149-160`; `outbox.repository.ts:35-43`). Payment-provider data must terminate at the Payment boundary and must not become a general integration event.
- **NEEDS VALIDATION:** the business retention period for operation keys, failed/abandoned checkout behavior, and whether a payer may intentionally retry with changed payment credentials.

## 5. Current state machine and choreography

### 5.1 Actual flow

The actual CARD flow is payment-first:

```text
startCheckout
  -> WooCommerce order creation/reconciliation
  -> payment.requested
  -> OrderSaga consumes payment.authorized
  -> stock.reservation-requested
  -> stock.reserved
  -> COMPLETED
```

Evidence: checkout creates `payment.requested` (`outbox.repository.ts:35-40`); `payment.authorized` changes `CREATED/PAYMENT_PENDING` through `PAYMENT_AUTHORIZED` to `STOCK_PENDING` and emits `stock.reservation-requested` (`order-saga.ts:76-93,168-178`). Inventory failure moves through `STOCK_FAILED` and `REFUND_PENDING` and emits `payment.refund-requested` (`order-saga.ts:94-113,180-190`). PIX generation terminates at `PIX_GENERATED` without an inventory transition (`order-saga.ts:114-118,191-196`).

### 5.2 Finding

The message transport is asynchronous, but choreography is not. `OrderSaga` contains the complete transition graph and knows when to request Inventory and Payment compensation. `MikroOrmOrderSagaRepository.apply` persists the central state and appends the selected next command (`order-saga.repository.ts:70-119`). This is precisely the prohibited `OrderWorkflow`/process-manager shape.

Target action: **REMOVE** the central state-machine coordinator. **CREATE** independent reactions:

- Transaction reacts to externally received order/checkout intent and publishes an order-received integration event.
- Inventory reacts to that event, decides locally, and publishes reserved/rejected.
- Payment reacts only to inventory-reserved, decides locally through its provider port, and publishes its result.
- Transaction reacts to Inventory/Payment outcomes only to update its own aggregate/read model.
- Inventory independently reacts to payment rejection/cancellation to release its own reservation.

The exact target catalog belongs to T-242; this audit only establishes that preserving the current `OrderSaga` is not allowed.

## 6. Inbox, outbox, delivery, ordering, and concurrency

### 6.1 Existing guarantees to retain

- Inbox claim uses `INSERT ... ON CONFLICT (event_id) DO NOTHING` and is committed with the state transition (`inbox.repository.ts:20-53`; `order-event.consumer.ts:35-76`).
- Workflow load uses `FOR UPDATE`; state update uses the expected previous state and increments `version` (`order-saga.repository.ts:32-89`).
- Outbox rows are created inside the local transaction and unsent rows use partial pessimistic locking ordered by occurrence (`outbox.repository.ts:28-58`).
- Publisher confirm is mandatory and persistent; unroutable events fail (`rabbitmq.ts:175-213`).
- Consumer uses manual ACK after handler success or confirmed retry/DLQ publication; failure to route a failed message causes NACK/requeue (`rabbitmq.ts:239-277`).
- Retry is bounded to 1 s, 10 s, and 60 s, after which a compact failure record is published to the DLX (`rabbitmq.ts:280-335`).
- No global order is assumed: the workflow row lock and state rules detect some future events (`order-saga.ts:121-141`).

### 6.2 Gaps

- **HIGH:** Inbox uniqueness is only `event_id`; the required target includes consumer identity. One event delivered to two local consumers cannot be represented independently (`Migration202608270002.ts:25-35`).
- **HIGH:** the envelope lacks `correlationId`, `causationId`, `aggregateId`, and `transactionId`; it instead requires `operationKey` and a trace object (`libs/contracts/events/envelope.schema.json:8-32`).
- **HIGH:** `OutboxPublisher` creates a synthetic trace id from the outbox id rather than preserving inbound correlation/causation (`outbox.publisher.ts:73-86`).
- **MEDIUM:** the DLQ replaces the original payload with a failure summary. Headers are only partially preserved and causation/contract version is not explicit (`rabbitmq.ts:313-334`). This conflicts with the required metadata-preservation test.
- **MEDIUM:** successful Rabbit publication and local `sent_at` update are not atomic, so crash-after-confirm can duplicate delivery. This is acceptable only with target consumer idempotency explicitly tested; exactly-once must not be claimed.
- **MEDIUM:** the state update does not assert the affected-row count (`order-saga.repository.ts:75-89`). Concurrent stale updates may still proceed to enqueue/notify unless PostgreSQL transaction behavior or a test proves otherwise.
- **HIGH:** `payment.failed` has a shared V1 schema (`libs/contracts/events/payment-failed.v1.schema.json:1-9`) but is absent from both `OrderSagaEventType` and the Workflow queue bindings (`order-saga.ts:5-10`; `order-workflow-messaging.runtime.ts:24-30`). A failed CARD payment therefore has no audited Workflow transition.
- **NEEDS VALIDATION:** per-key ordering requirements and partitioning/concurrency behavior on Amazon MQ, including multiple Java replicas and quorum-queue support/configuration.

## 7. Current RabbitMQ topology

| Artifact | Current value | Evidence | Action |
|---|---|---|---|
| Main exchange | `marketplace.events.v1`, topic, durable | `rabbitmq.ts:5,117-128` | **REFACTOR** after target event catalog; compatibility bridge may retain it temporarily. |
| Retry exchange | `marketplace.retry.v1`, direct, durable | `rabbitmq.ts:6,123-125` | **KEEP** behavior; declare with Spring AMQP. |
| Dead-letter exchange | `marketplace.dead-letter.v1`, topic, durable | `rabbitmq.ts:7,126-128` | **KEEP** behavior; define operator/replay policy. |
| Shared DLQ | `marketplace.dead-letter.v1`, quorum | `rabbitmq.ts:8,130-138` | **SPLIT** if ownership/least privilege requires per-consumer DLQs; decision belongs to T-242. |
| Workflow queue | `order-workflow-subgraph.v1`, quorum | `order-workflow-messaging.runtime.ts:23-30`; `rabbitmq.ts:141-153` | **REMOVE** with Node service; replace with explicit Transaction-context queues. |
| Workflow bindings | `payment.authorized`, `payment.pix-generated`, `payment.refunded`, `stock.reservation-failed`, `stock.reserved` | `order-workflow-messaging.runtime.ts:24-30` | **REFACTOR** to the approved choreographed catalog. |
| Retry queues | `<consumer>.retry.1..3`, quorum; TTL 1/10/60 s; dead-letter return | `rabbitmq.ts:155-172` | **KEEP** bounded-backoff semantics. |
| Publish routing key | Exact `event.eventType` | `rabbitmq.ts:216-235` | **REFACTOR** only after versioned routing-key policy is approved. |
| Broker in Compose | `rabbitmq:4.1.3-management` | `compose.yaml:48-59` | **KEEP** for local runtime; future integration tests remain real RabbitMQ/Testcontainers. |

The current topology is declared independently by each runtime connection (`connectRabbitMq` calls `declareRabbitMqTopology`, `rabbitmq.ts:78-98`) and the Workflow opens three connections for consumer, outbox, and failure publication (`order-workflow-messaging.runtime.ts:41-73`). The Java target should use Spring AMQP configuration, not `axon-amqp:4.x`, while retaining publisher confirms, mandatory routing, manual acknowledgement, bounded retry, and DLQ observability.

## 8. GraphQL Federation, OAuth, and SSE

### 8.1 GraphQL and federation

- The supergraph has `identity`, `wordpress`, `payment`, and `order-workflow`; the Workflow routing URL is `/graphql` on port 3003 (`libs/contracts/graphql/supergraph.yaml:4-20`).
- Gateway `LocalCompose` reads checked-in SDL and creates capability-aware data sources (`gateway-federation.configuration.ts:28-69`).
- WordPress receives session state, Payment and Identity receive bearer tokens, and Workflow receives bearer plus request session (`gateway-federation.configuration.ts:74-84`).
- The current Workflow SDL exposes `checkout`, `startCheckout`, `Order.workflow`, and `orderEvents(operationKey)` (`libs/contracts/graphql/order-workflow/schema.graphql:8-77`).
- Workflow resolvers have thin delegation and field scopes, but `OrderWorkflowOperationsService` queries MikroORM entities directly and returns persistence-backed state (`order-workflow-operations.service.ts:20-77`).

Disposition: **KEEP** the checked-in federation contract boundary and gateway composition; **MOVE/REFACTOR** the Workflow contract implementation to Spring GraphQL DTO/view and command/query gateways. Preserve the public contract behind a compatibility period rather than switching atomically without a consumer audit.

### 8.2 OAuth ownership

Identity remains the authorization server: `OAuthIssuerModule` owns Better Auth client provisioning (`libs/identity/nest/src/oauth-issuer/oauth-issuer.module.ts:12-30`). Gateway verifies the public request and maps credential failures to GraphQL authentication errors (`libs/gateway/nest/src/auth/auth-context.factory.ts:29-68`). Workflow independently verifies issuer, JWKS, audience, and scopes (`apps/order-workflow-subgraph/src/graphql/order-workflow-graphql.module.ts:43-79`), including the SSE authentication hook (`graphql/sse/sse-handler.ts:20-47`).

Disposition: **KEEP** Identity and Gateway ownership. **CREATE** a Java OAuth resource-server boundary with equivalent audience and `cart:write`/`orders:read` semantics. Do not create another issuer in Java.

### 8.3 Actual SSE path

```text
Client
  -> Gateway POST /graphql/stream
  -> Gateway AuthContextFactory
  -> graphql-sse client with bearer + x-request-id
  -> Node Order Workflow POST /graphql/stream
  -> OAuthResourceService + orders:read guard
  -> OrderEventsSubscription(subject, operationKey)
  -> initial PostgreSQL replay + PostgreSQL LISTEN/NOTIFY live wake-up
  -> in-memory OrderEventBroker
  -> AsyncIterable -> graphql-sse response
  -> Gateway proxy -> Client
```

Evidence: gateway route and default downstream URL (`apps/gateway/src/app.module.ts:25-49`); header forwarding (`order-workflow-subscription.client.ts:22-36`); Workflow route (`order-workflow-graphql.module.ts:81-87`); owner/key binding (`order-workflow.resolver.ts:74-89`); replay and live ordering (`order-events.subscription.ts:61-147`); PostgreSQL notification relay (`postgres-order-event.relay.ts:55-109`).

The target requires `Axon event -> QueryUpdateEmitter -> subscriptionQuery -> @SubscriptionMapping -> Flux -> SSE`. Therefore the custom relay/broker is **REMOVE/REFACTOR**, while subject/transaction filtering, initial state, version suppression, cancellation, bounded buffering, and lifecycle tests are behavior to **KEEP**.

### 8.4 WordPress subscription gap

The WordPress publication contract defines queries and mutations only (`libs/contracts/graphql/wordpress/schema.graphql:206-218`); it has no `Subscription` type. The public tested subscription is opened at `${gatewayUrl}/graphql/stream`, not at WordPress (`apps/e2e/src/journey.ts:466-475`). The gateway manually delegates every subscription request to the single Order Workflow downstream; Apollo Federation query planning is not used for this path (`apps/gateway/src/subscriptions/sse-handler.ts:22-38`).

This means the required “WordPress/GraphiQL surface -> Java subscription” acceptance path is **not implemented and NOT VERIFIED**. T-242 must choose and document one technically verified ownership path (for example, Gateway GraphiQL/public SSE with WordPress participating only as a federated data owner, or a supported WordPress proxy/plugin). It must not claim that Apollo Federation routes SSE subscriptions automatically.

## 9. WordPress and WooCommerce integration

### 9.1 Current boundary

- WordPress 6.8.2, WooCommerce 10.4.3, WPGraphQL 2.20.0, WPGraphQL WooCommerce 1.0.3, Headless Login 0.4.4, and a pinned federation commit are installed by Compose (`compose.yaml:118-175`).
- The reconciliation plugin declares HPOS compatibility and registers both legacy and HPOS native search meta-key filters (`order-workflow-reconciliation.php:25-42,48-97`).
- Checkout uses native WPGraphQL WooCommerce cart and checkout operations, attaches a deterministic operation-reference meta field, and reconciles through native order search (`woo-checkout.adapter.ts:64-182`).
- Service reconciliation logs in through the pinned Site Token provider, while buyer cart/session credentials are used only for cart/checkout calls (`woo-checkout.adapter.ts:39-55,93-135`).

### 9.2 Disposition and risks

- **KEEP:** WordPress/WooCommerce remains the commerce system of record and external boundary.
- **KEEP:** the small reconciliation plugin; it is HPOS-compatible, uses native hooks, and does not access order tables directly.
- **MOVE:** the TypeScript WPGraphQL client into a Java infrastructure ACL implementing an inward port.
- **KEEP:** `_order_workflow_operation_reference` semantics and reconciliation tests during coexistence.
- **REFACTOR:** remove the hard-coded fallback currency `BRL` from response normalization unless the target contract proves currency absent is impossible (`woo-checkout.adapter.ts:86-91,225-235`).
- **HIGH:** payment provider token is carried by the Workflow contract and RabbitMQ event. Establish tokenization/data-classification rules before porting it.
- **NEEDS VALIDATION:** authenticity model for any WooCommerce-originated webhook; no order webhook consumer exists in this audited scope.
- **NEEDS VALIDATION:** desired mapping between Woo order statuses and target Transaction states. The current shared WordPress SDL publishes only `COMPLETED` and `PROCESSING` (`libs/contracts/graphql/wordpress/schema.graphql:178-181`).

## 10. Current persistence and deployment

### 10.1 Datastores and tables

Current root Compose uses separate PostgreSQL databases for Workflow, Identity, and Payment plus MariaDB for WordPress (`compose.yaml:61-116`). This differs from the approved first target of one PostgreSQL/RDS instance with isolated `transaction`, `inventory`, and `payment` schemas.

Order Workflow connects to database `order_workflow` without an explicit schema (`apps/order-workflow-subgraph/src/persistence/mikro-orm.config.ts:9-27`). Its migrations create unqualified tables in the default schema:

| Table | Purpose | Evidence | Target action |
|---|---|---|---|
| `order_workflow_checkout_operation` | operation-key ownership, command hash, Woo reconciliation lease | `Migration202608270001.ts:5-20`; `Migration202609010001.ts:5-15` | **MOVE** to Transaction-owned schema/model. |
| `order_workflow_order_workflow` | central state, Woo id, items, payment id, PIX code, version | `Migration202608270001.ts:23-35`; `Migration202608270002.ts:11-21`; later migrations | **SPLIT/REMOVE**; central orchestration state must not survive as an aggregate. |
| `order_workflow_outbox_event` | local outbox with attempt/sent timestamps | `Migration202608270001.ts:38-54`; `Migration202608270002.ts:5-9` | **CREATE** context-owned outbox tables with approved metadata. |
| `order_workflow_inbox_record` | event-id deduplication and disposition | `Migration202608270002.ts:24-36` | **CREATE** context-owned inbox tables keyed by consumer plus event id. |

There are no `transaction`, `inventory`, or `payment` schema-creation migrations in the audited Workflow scope. There is no cache or search engine in the runtime topology, which already aligns with the approved initial infrastructure constraint.

### 10.2 Deployment

- Order Workflow is a dedicated Node 24 image and service with PostgreSQL, RabbitMQ, WordPress, JWKS and OAuth configuration (`apps/order-workflow-subgraph/Dockerfile:1-20`; `compose.yaml:328-368`).
- Gateway waits for Workflow, WordPress, Payment, and Identity health (`compose.yaml:226-259`).
- Payment is the existing Java service on port 8080; Workflow remains Node on port 3003 (`compose.yaml:328-416`).
- Readiness for Workflow requires the database, RabbitMQ runtime, and PostgreSQL notification relay (`apps/order-workflow-subgraph/src/health.controller.ts:35-47`).

Migration action: **REMOVE** the Node Workflow deployment only after Java serves compatible GraphQL/SSE contracts and consumes/publishes the approved AMQP contracts. **REFACTOR** gateway route/environment and Compose dependencies during a reversible cutover. The exact rolling/blue-green strategy is **NEEDS VALIDATION** because production ingress, DNS, AWS manifests, and database migration tooling are not present in this scope.

## 11. Test coverage audit

| Behavior | Existing evidence | Assessment / migration requirement |
|---|---|---|
| Checkout command hash/reference | `checkout/command-hash.spec.ts:5-45` | Characterization exists; port fixtures to Java. |
| Checkout validation, key conflict, lease recovery | `checkout/checkout.service.spec.ts:69-377` | Unit coverage exists; retain semantic outcomes. |
| Concurrent lease and atomic workflow/outbox | `checkout/checkout.repository.integration.spec.ts:72-299` | Real PostgreSQL Testcontainer coverage exists; recreate without H2. |
| Woo checkout/reconciliation ACL | `checkout/woo-checkout.adapter.spec.ts:27-448` | HTTP adapter is mocked; future Java integration/contract test must validate pinned WPGraphQL behavior. |
| Central state transitions/out-of-order events | `saga/order-saga.spec.ts:14-229` | Good characterization of legacy behavior, but target tests must prove independent choreography rather than port this class. |
| Inbox atomicity/deduplication and outbox locking | `saga/order-event.consumer.integration.spec.ts:67-330` | Real PostgreSQL coverage exists for current central consumer. Split by bounded context. |
| RabbitMQ publish, routing, retry | `messaging/rabbitmq.integration.spec.ts:19-104` | Real RabbitMQ Testcontainer validates one retry and unroutable publish. Missing full DLQ/header/metadata assertions. |
| Outbox mapping/confirm handling | `outbox/outbox.publisher.spec.ts:7-100` | Unit only; no end-to-end “broker unavailable -> pending -> restored -> sent” proof. |
| Workflow SSE endpoint/auth/lifecycle | `graphql/sse/sse.integration.spec.ts:22-210` | Real HTTP/SSE boundary exists but uses mocked resource verification, operations, broker and persistence. |
| Replay/filter/backpressure | `order-events/order-events.subscription.spec.ts:12-228` | Strong unit characterization; target needs Reactor/real endpoint equivalents. |
| Gateway authenticated federation | `libs/gateway/nest/src/gateway-path.integration.spec.ts:133-251` | In-process integration evidence; preserve bearer/session capability rules. |
| Public Compose journey | `apps/e2e/src/journey.ts:466-524`; `test/milestone-7-e2e-contract.test.mjs:104-151` | Journey opens gateway SSE and observes terminal events. It does not prove WordPress owns/initiates the subscription. |
| WordPress federation/ownership | `apps/wordpress-integration/scripts/probe.mjs:119-355` | Exercises real WordPress/WPGraphQL and composition, but not subscriptions or workflow events. |
| HPOS plugin structure | `test/structural-wordpress-review.test.mjs:8-43` | Structural proof; add executable Plugin Check/Woo integration validation if required by deployment. |
| Target T-241 criteria | no `@spec:AC-285` through `@spec:AC-291` or `@spec:AC-293` found in audited production tests | Expected for planning phase; the implementation plan must assign each criterion to executable tests. |

No tests were executed in T-241; this is an evidence audit, not a validation run. Existing test names show intended coverage but are not presented as current pass results. The following target tests are absent and therefore **NOT VERIFIED**: Axon event replay, Axon projections, `QueryUpdateEmitter` subscription flow, no-hidden-orchestrator ArchUnit rule, schema isolation/cross-schema prohibition, full choreographed happy/failure paths through RabbitMQ, DLQ metadata preservation, broker outage recovery, and WordPress-surface SSE acceptance.

## 12. Violations and risks

| Severity | File / symbol | Rule violated and evidence | Required correction |
|---|---|---|---|
| **CRITICAL** | `saga/order-saga.ts:72-208`, `OrderSaga` | One class owns the whole Payment/Inventory/Order transition graph and emits the next context command. This is the forbidden orchestrator/process manager. | Remove it; implement event-reaction handlers that know only their own bounded context. |
| **CRITICAL** | `outbox/outbox.repository.ts:35-40`, `OrderSaga` at `order-saga.ts:76-93` | Flow requests Payment before Inventory. It conflicts with the mandatory target happy path where Inventory reserves before Payment is requested. | Introduce `OrderReceived` and let Inventory react first; Payment reacts only to successful reservation. |
| **HIGH** | `checkout/checkout.service.ts:149-160` and `outbox/outbox.repository.ts:35-43` | Order Workflow builds and persists a Payment integration payload including provider token/method id. Payment-provider concerns leak across the Transaction boundary. | Move provider intent mapping and sensitive-token handling behind the Payment application/infrastructure boundary. |
| **HIGH** | `saga/order-saga.ts:35-38,161-207` | Domain decision code uses integration routing names and transport-shaped payload maps; Domain Event and Integration Event are not separated. | Create typed domain events, application mappers, and separately versioned integration events. |
| **HIGH** | `libs/contracts/events/envelope.schema.json:8-32` | Required target causal metadata (`correlationId`, `causationId`, `aggregateId`, `transactionId`) is absent. | Version the envelope with explicit fields and compatibility tests. |
| **HIGH** | `persistence/migrations/*.ts` | Tables are unqualified and no required context schemas exist. | Create Flyway/Liquibase migrations for owned `transaction`, `inventory`, and `payment` schemas; forbid cross-context joins/FKs. |
| **HIGH** | `libs/contracts/graphql/wordpress/schema.graphql:206-218`; `apps/e2e/src/journey.ts:466-475` | WordPress GraphQL exposes no subscription; acceptance uses Gateway SSE directly. The mandatory WordPress/GraphiQL path is absent. | Decide a supported public surface/proxy and add an executable acceptance test. |
| **HIGH** | `order-events/postgres/postgres-order-event.relay.ts:12-109` | Subscription updates use PostgreSQL notifications and an in-memory broker, not the mandated Axon subscription-query pattern. | Replace with Axon event handler, query update emitter, subscription query and Spring GraphQL `Flux`. |
| **HIGH** | `order-workflow-messaging.runtime.ts:24-30`; `order-saga.ts:5-10` | `payment.failed` is a published shared contract but is neither bound nor modeled by Workflow, leaving the failed-payment state path incomplete. | Add the target Payment-rejected integration reaction and Transaction terminal-state behavior as independent choreography. |
| **MEDIUM** | `inbox/inbox.repository.ts:26-36`; inbox migration | Inbox identity is global event id only, not `(consumer, eventId)`. | Use a per-context/per-consumer key and prove atomic deduplication. |
| **MEDIUM** | `outbox/outbox.publisher.ts:80-85` | Trace id is generated from the outgoing event rather than preserving the causal chain. | Propagate correlation/causation explicitly from inbound message or originating command. |
| **MEDIUM** | `rabbitmq.ts:313-334` | DLQ message discards original payload and most original headers. | Define failure envelope/replay policy and preserve required metadata; test it with RabbitMQ. |
| **MEDIUM** | `order-saga.repository.ts:75-99` | Optimistic state predicate update has no affected-row assertion before follow-on enqueue/notify. | Make concurrency conflict explicit and test stale/concurrent messages. |
| **MEDIUM** | `checkout/checkout.service.ts:53-77` | Unbounded 50 ms polling has no deadline or request cancellation. | Use a bounded application outcome and durable reconciliation path. |
| **LOW** | `woo-checkout.adapter.ts:86-91,225-235` | Missing currency becomes BRL silently. | Require/validate currency or document and test the fallback as a business rule. |

## 13. KEEP / REFACTOR / MOVE / SPLIT / REMOVE / CREATE summary

- **KEEP:** deterministic idempotency semantics; Woo operation reference; native WooCommerce ownership; HPOS plugin; OAuth issuer ownership; gateway as public federation edge; real PostgreSQL/RabbitMQ integration testing; manual ACK, confirms, bounded retry and DLQ concepts; owner-scoped subscription behavior.
- **REFACTOR:** event envelope, RabbitMQ topology/configuration, GraphQL read/write DTOs, gateway SSE downstream, outbox publisher, subscription behavior and deployment health checks.
- **MOVE:** checkout transaction behavior, inbox/outbox implementations, GraphQL resolvers/controllers, OAuth resource-server enforcement, and WooCommerce ACL into the appropriate Java layers and schemas.
- **SPLIT:** central checkout/application queries, central event consumer, persistence ownership, and workflow state into Transaction, Inventory, and Payment responsibilities.
- **REMOVE:** Node `OrderSaga`, `MikroOrmOrderSagaRepository`, manual messaging runtime, PostgreSQL notification relay, in-memory subscription broker, and eventually the Node Order Workflow deployment after verified cutover.
- **CREATE:** explicit bounded-context event reactions; typed Domain Events; versioned Integration Event mappers; per-context inbox/outbox; required schemas and migrations; Axon projections/subscription queries; Java GraphQL/SSE endpoint; WordPress-surface acceptance route/test; architecture and choreography tests.

## 14. NEEDS VALIDATION / NOT VERIFIED register

1. **NEEDS VALIDATION:** exact public ownership of the WordPress/GraphiQL subscription surface and whether the pinned WordPress/Apollo versions can proxy the required SSE protocol.
2. **NEEDS VALIDATION:** backward-compatibility window and consumers for every existing routing key/schema before renaming events.
3. **NEEDS VALIDATION:** whether `operationKey` becomes `transactionId`, remains a separate idempotency key, or both are retained.
4. **NEEDS VALIDATION:** target checkout timeout, lease duration, retention, abandoned-operation cleanup, and payment-credential retry semantics.
5. **NEEDS VALIDATION:** payment token classification, persistence prohibition, logging/redaction, and end-to-end handling ownership.
6. **NEEDS VALIDATION:** post-payment failure policy, refund policy, and terminal Transaction status definitions.
7. **NEEDS VALIDATION:** WooCommerce order-status mapping and webhook authenticity/reconciliation requirements.
8. **NEEDS VALIDATION:** Amazon MQ topology support, permissions, quorum queues, publisher-confirm configuration, and replica ordering strategy.
9. **NEEDS VALIDATION:** production AWS deployment, ingress, DNS, secret management, observability backend, migration runner, and rollback mechanism; no deployment manifests for these were audited.
10. **NOT VERIFIED:** any Axon 5 event-sourcing, query-gateway, or subscription-query behavior; T-240 owns the Java/reference audit.
11. **NOT VERIFIED:** full current suite pass state; T-241 inspected tests but did not execute them.
12. **NOT VERIFIED:** real WordPress-to-Java SSE acceptance, broker-outage recovery, full DLQ metadata, complete choreography, and required schema isolation.

## 15. Constraints handed to T-242 and T-243

- Do not port `OrderSaga`; use it only as a legacy behavior catalog.
- Do not preserve the current payment-first order as the target happy path.
- Preserve checkout idempotency and Woo reconciliation with characterization fixtures before cutover.
- Keep Identity as OAuth issuer and Gateway as the likely public federation/SSE edge unless technical validation proves another supported route.
- Use Axon 5 for internal commands, event sourcing, CQRS, projections and subscription queries; use Spring AMQP/RabbitMQ only for versioned integration events between bounded contexts.
- Define a compatibility strategy for current GraphQL fields and RabbitMQ V1 events; do not silently break them.
- Require per-context local atomicity for state/domain-event-to-outbox mapping and inbox deduplication; explicitly accept at-least-once delivery.
- Require PostgreSQL Testcontainers, RabbitMQ Testcontainers, real HTTP GraphQL/SSE tests, architecture tests, contract tests, and full happy/failure choreography tests in the phased plan.
- Treat every item in Section 14 as an explicit blocker, question, or `NOT VERIFIED` item until evidence closes it.
