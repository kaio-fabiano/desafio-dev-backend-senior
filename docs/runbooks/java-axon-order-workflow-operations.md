# Java Axon order workflow operations

The `payment-federation` deployment is the sole owner of Transaction,
Inventory, and Payment. Gateway sends the compatible Order Workflow GraphQL
contract and SSE subscriptions to its `/graphql` endpoint. Cross-context facts
use `marketplace.events.v1` and context-owned RabbitMQ queues; no operator may
re-enable the retired Node writer.

## Retired Node evidence

`apps/order-workflow-subgraph` was deliberately removed after the Java cutover.
Its surviving runtime responsibilities are implemented under
`apps/payment-federation/src/main/java/dev/desafio/transaction`, and the current
retirement, routing, compatibility, and quality-gate evidence is exercised by
`test/migrate-order-workflow-to-axon-java.test.mjs`. Historical task records may
reference this section as durable evidence of the removed source paths; they do
not imply that the Node application remains deployable.

Run commands from the repository root. Any failed check blocks release and is
owned by the release operator until the relevant context owner accepts it.

## Replay and projection rebuild

Quiesce Gateway mutations, back up PostgreSQL, and record the highest Axon
processor token. Run the replay proof before changing a production processor:

```sh
corepack pnpm exec nx run payment-federation:test --skip-nx-cache
```

Use the Axon processor controls approved for the target environment to reset
only the named Transaction projection processor. Resume it, wait for the token
to reach the recorded head, then compare `transaction.transaction_view` with
the pre-replay export. Sourcing handlers must perform no WooCommerce, payment,
or RabbitMQ effect during replay.

## Outbox recovery

Stop the affected Spring listener, fix broker reachability, and inspect pending
rows in the owning schema without editing payloads or causal identifiers.
Restart `payment-federation`; the context relay republishes pending rows with
publisher confirms. Verify that the row becomes published and the receiving
context has one `(consumer_name,event_id)` inbox record.

## DLQ replay

Export the original body and headers from the affected `<consumer>.dlq.v1`
queue, remove credentials from operator notes, and fix the cause first. Publish
the unchanged envelope to its original routing key. Inbox deduplication makes a
repeated event harmless. Never acknowledge or purge a DLQ message before its
event ID and resolution are recorded in the incident.

## Migrations

Flyway owns the `axon`, `transaction`, `inventory`, and `payment` schemas. The
release runner applies migrations before traffic and fails on validation drift:

```sh
corepack pnpm exec nx run payment-federation:test --skip-nx-cache
docker compose --file compose.yaml config --quiet
```

Do not use Hibernate auto-DDL, cross-schema foreign keys, joins, or repository
reads. A failed migration stops the deployment; restore into isolation before
attempting repair.

## Backup and restore

Create an encrypted PostgreSQL snapshot immediately before migration or replay
and retain it under the approved 30-day policy. Restore to an isolated database,
run Flyway validation, start one Java instance with RabbitMQ publication
disabled, and execute GraphQL query plus projection checks. Record snapshot ID,
source commit, restore duration, row counts, and the successful smoke result.
Only that evidence authorizes destructive retention cleanup.

## Observability

Health and metrics are served by Spring Boot Actuator:

```sh
curl --fail --silent http://payment-federation:8080/actuator/health
curl --fail --silent http://payment-federation:8080/actuator/prometheus
```

Trace a transaction by `transactionId`, `correlationId`, `causationId`, and
`eventId` across the context outboxes, RabbitMQ deliveries, inbox records, and
projection update. Alert on readiness failure, pending-outbox age, DLQ depth,
consumer lag, and projection-token lag; logs must not contain payment tokens.

## Incident ownership

- Transaction owns checkout, WooCommerce reconciliation, projections, GraphQL,
  and subscription queries.
- Inventory owns reserve, commit, release, stock effects, inbox, and outbox.
- Payment owns provider effects, webhooks, refunds, inbox, and outbox.
- Platform owns Gateway routing, PostgreSQL, RabbitMQ, backups, telemetry, and
  deployment recovery.

The first owner diagnoses its local state and hands off only with the event ID,
causal chain, current projection version, and durable inbox/outbox evidence.

## Forward recovery

After Java accepts the first post-cutover command, rollback must not restore the
Node writer. Quiesce new commands, preserve database and queue evidence, repair
the failing Java context, replay pending outbox/DLQ events using their original
identities, rebuild affected projections, and reopen traffic only after health,
GraphQL, SSE, and choreography checks pass. Before the first Java write, a
revision rollback is allowed only with the documented clean-start and single-
writer checks repeated.
