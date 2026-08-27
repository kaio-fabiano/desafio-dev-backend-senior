# Milestone 3 cart and order gate

From a clean clone with dependencies installed and Docker available, start the
pinned PostgreSQL and WordPress stack and wait for every service to become
healthy:

```sh
docker compose --project-name milestone-3-cart-order up --detach --wait
```

Run the focused Milestone 3 acceptance suite:

```sh
node --experimental-transform-types --test --test-reporter=tap test/milestone-3-*.test.mjs
```

The suite proves token-derived cart ownership, deterministic validation,
sequential and concurrent checkout idempotency, conflict detection, recovery
after a remote WooCommerce order, atomic workflow/outbox persistence, and the
federated `me` order journey with batched products. The same suite is available
through `nx run @desafio-dev-backend-senior/commerce-subgraph:acceptance`.

The feature-level verification and repository audit are owned by the
orchestrator:

```sh
node .agents/skills/onp-spec-driven/scripts/onp-spec.mjs verify milestone-3-cart-order
node .agents/skills/onp-spec-driven/scripts/onp-spec.mjs audit --ci
```

When finished, remove containers and persistent test volumes:

```sh
docker compose --project-name milestone-3-cart-order down --volumes
```
