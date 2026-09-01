# Milestone 4 payment and inventory saga

## Acceptance

Install workspace dependencies, ensure Docker is running, then execute:

```bash
pnpm exec nx run @desafio-dev-backend-senior/e2e:milestone-4-acceptance
docker compose --file compose.yaml config --quiet
docker build --file apps/payment-processor/Dockerfile .
```

The Nx target covers event contracts, confirmed outbox publication, bounded
RabbitMQ retry and DLQ behavior, Card and Pix idempotency, inventory success and
compensation, monotonic saga transitions, and crash-before-acknowledgement
redelivery. The Docker commands validate the production runtimes without
publishing host ports.

## Operations

Start the stack with `docker compose up --build --wait`. Inspect failed events
in the durable `marketplace.dead-letter` queue through RabbitMQ tooling. Its
payload contains correlation identifiers and a safe reason, never credentials
or buyer data. Fix the cause before replaying a message with its original event
and operation identifiers.

Use `docker compose stop --timeout 35 payment-processor order-workflow-subgraph` for
planned shutdown. Consumers stop accepting deliveries,
finish active effects, close broker connections, and only then exit. Preserve
the Commerce and payment PostgreSQL volumes while diagnosing state.
