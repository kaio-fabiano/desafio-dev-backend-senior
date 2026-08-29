# Local development runbook

## Prerequisites

Install Node.js 24, Corepack, Docker Engine with Compose, and Java 21. The
workspace pins pnpm 10.17.1; use Corepack so local and CI resolution agree. Do
not place credentials in files or shell history.

## Start the five-application topology

```sh
corepack pnpm@10.17.1 install --frozen-lockfile
docker compose --file compose.yaml up --build --wait
```

Use `docker compose ps` and service health checks to diagnose startup. Logs are
read with `docker compose logs --follow <service>`; stop with `docker compose
down` (add `--volumes` only when intentionally resetting local data).

## Quality gates

Run each gate from the repository root. A focused gate does not replace a later
gate.

```sh
# Project build, typecheck, lint, and unit targets through Nx
corepack pnpm@10.17.1 run quality:nx

# Architecture and provider boundaries
node --experimental-transform-types --test --test-reporter=tap \
  test/architecture-boundaries.test.mjs \
  test/federated-platform-refactor.test.mjs \
  test/nest-provider-composition.test.mjs \
  test/identity-federation-refactor.test.mjs \
  test/gateway-federation-refactor.test.mjs \
  test/wordpress-federation-refactor.test.mjs \
  test/order-subscription-refactor.test.mjs \
  test/federated-platform-quality.test.mjs

# Schema composition
node --test --test-reporter=tap test/milestone-1-graphql-contracts.test.mjs

# Coverage and language-specific integration tests
corepack pnpm@10.17.1 run quality:coverage
```

The architecture gate proves dependency direction and composition ownership;
the composition gate proves compatible Federation SDL; Nx proves project
quality; the coverage target includes Payment's Gradle tests. The complete
local command and its recorded result are in the [architecture
review](../evidence/federated-platform-refactor/review.md).

The canonical isolated journey is documented in the [E2E runbook](e2e.md).
Keep test credentials ephemeral and supplied through the environment.
