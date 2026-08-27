# Local development runbook

## Prerequisites

Install Node.js, Corepack/pnpm, Docker Engine with Compose, and Java 21 for the payment processor. Do not place credentials in files or shell history.

## Start and validate

```sh
corepack pnpm install --frozen-lockfile
docker compose --file compose.yaml up --build --wait
corepack pnpm test:spec
```

Use `docker compose ps` and service health checks to diagnose startup. Logs are read with `docker compose logs --follow <service>`; stop with `docker compose down` (add `--volumes` only when intentionally resetting local data).

The canonical isolated journey is documented in the [E2E runbook](e2e.md). Keep test credentials ephemeral and supplied through the environment.
