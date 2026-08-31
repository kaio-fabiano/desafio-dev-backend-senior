# Local development runbook

## Prerequisites

Install Node.js 24, Corepack, Docker Engine with Compose, and Java 21. The
workspace pins pnpm 10.17.1; use Corepack so local and CI resolution agree. Do
not place credentials in files or shell history.

When Node is managed by `fnm`, initialize it in the current shell or execute the
pinned local version explicitly:

```sh
fnm exec --using v24.19.0 -- node --version
fnm exec --using v24.19.0 -- npm --version
```

## Start the five-application topology

The setup pins WPGraphQL Headless Login and configures its server-only Site
Token plus a signed WooCommerce `order.updated` webhook. Override
`WPGRAPHQL_SITE_TOKEN` and `WOO_WEBHOOK_SECRET` outside local development; never
expose either value to a browser client.

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
  test/payment-federation-refactor.test.mjs \
  test/order-subscription-refactor.test.mjs \
  test/five-app-topology.test.mjs \
  test/federated-platform-quality.test.mjs

# Schema composition
node --test --test-reporter=tap test/five-app-topology.test.mjs

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

## Spec-anchored completion gate

After the implementation and E2E gates pass, refresh the feature proof and run
the repository audit:

```sh
node .agents/skills/onp-spec-driven/scripts/onp-spec.mjs \
  verify federated-platform-architecture-refactor
node .agents/skills/onp-spec-driven/scripts/onp-spec.mjs audit --ci
```

The delivery is complete only when both commands exit zero. The final
2026-08-30 execution proved 14/14 feature criteria and 103/103 repository
criteria with no audit warnings.
