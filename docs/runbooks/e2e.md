# End-to-end runbook

The E2E acceptance target owns the lifecycle: it starts the isolated Compose
environment, waits for healthy services, obtains short-lived test credentials,
runs the buyer journey, and tears the environment down even after a failure.

```sh
corepack pnpm@10.17.1 run acceptance:milestone-7
```

To inspect the acceptance contract without starting containers, run:

```sh
node --test --test-reporter=tap test/milestone-7-e2e-contract.test.mjs
```

The journey covers:

1. Better Auth registration and WordPress account linkage;
2. scoped access through Gateway and Apollo MCP using the same short-lived
   bearer token;
3. WooCommerce-authoritative catalog plus durable Order Workflow checkout/outbox;
4. RabbitMQ payment and inventory reactions inside Payment Federation, including
   idempotent Card, stable Pix, and failed-stock compensation;
5. an authenticated order stream opened at Gateway's `/graphql/stream`
   endpoint before checkout; and
6. rejection of missing identity, wrong audience, missing scopes, or another
   buyer's operation key by the owning federation.

The inventory leg proves that Payment Federation calls WordPress's native,
plugin-federated `/graphql` endpoint and that
`apps/wordpress-integration/marketplace-inventory.php` is absent because the
installed plugins already expose the required capabilities.

Gateway serves federated queries, mutations, and the authenticated SSE edge;
Order Workflow is the sole owner and publisher of the order-event stream.
Compare the terminal stream event with the federated order/payment view
and the corresponding MCP operation before accepting the run.

The final delivery-closure execution on 2026-09-02 passed all six scenarios.
It proved both Card and Pix journeys, compensation, authenticated SSE,
persistent order/payment reads after the write, and MCP parity. A skipped
scenario is not a pass and must keep the gate red.

Never paste bearer tokens, client secrets, authorization headers, or token
payloads into logs or evidence. Record only the command, timestamp, exit status,
and sanitized assertions in the [architecture
review](../evidence/federated-platform-refactor/review.md).
