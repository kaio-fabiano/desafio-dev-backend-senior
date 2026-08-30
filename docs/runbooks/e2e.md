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
3. native WooCommerce catalog, cart, checkout, order, and inventory behavior;
4. idempotent card authorization and stable Pix output from Payment Federation;
5. an authenticated order stream opened directly at WordPress Federation's
   `/graphql/stream` endpoint before checkout; and
6. rejection of missing identity, wrong audience, missing scopes, or another
   buyer's operation key by the owning federation.

Gateway serves federated queries and mutations but does not proxy the SSE
stream. Compare the terminal stream event with the federated order/payment view
and the corresponding MCP operation before accepting the run.

The final architecture-refactor execution on 2026-08-30 passed all five
scenarios. It proved both Card and Pix journeys, direct authenticated SSE,
persistent order/payment reads after the write, and MCP parity. A skipped
scenario is not a pass and must keep the gate red.

Never paste bearer tokens, client secrets, authorization headers, or token
payloads into logs or evidence. Record only the command, timestamp, exit status,
and sanitized assertions in the [architecture
review](../evidence/federated-platform-refactor/review.md).
