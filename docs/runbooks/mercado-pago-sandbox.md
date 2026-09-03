# Mercado Pago sandbox runbook

This procedure is opt-in. It moves test money against Mercado Pago and requires
external test credentials plus an HTTPS callback reachable by Mercado Pago.
The normal repository gate remains credential-free.

## Preconditions

- Java 21, Docker, Node.js 24, Corepack, and repository dependencies are
  available.
- A Mercado Pago test account supplies an access token and webhook secret
  through the ignored local `.env`. Never commit them or paste them into logs,
  screenshots, issue comments, shell history, or evidence files.
- The public callback forwards only to
  `POST /webhooks/mercado-pago`; its TLS endpoint and tunnel logs are controlled.
- Card input is rendered and tokenized by Mercado Pago.js or Bricks. Only the
  returned short-lived `providerToken` reaches this platform. Never send PAN,
  expiry, cardholder document, or security-code fields to GraphQL or RabbitMQ.

Configure the local runtime in the ignored root `.env`:

```text
PAYMENT_PROVIDER_MODE=mercado-pago
MERCADO_PAGO_ACCESS_TOKEN=<secret-store reference>
MERCADO_PAGO_WEBHOOK_SECRET=<secret-store reference>
MERCADO_PAGO_API_BASE_URL=https://api.mercadopago.com
MERCADO_PAGO_CONNECTION_TIMEOUT=5s
MERCADO_PAGO_READ_TIMEOUT=15s
```

Do not place production credentials in local files. The root `.env` is ignored
by Git and is only for test credentials. An empty, malformed, or non-official
endpoint must prevent Mercado Pago mode from starting. Deterministic mode is
the Compose default when `PAYMENT_PROVIDER_MODE` is absent and is not a
production fallback.

## Start the local real-provider runtime

Docker Compose reads the root `.env` automatically, including from Fish. Start
the complete local topology and wait for Payment Federation readiness:

```sh
docker compose up --detach --build --wait
docker compose port payment-federation 8080
```

The second command prints the random loopback port published for Payment
Federation. Point the approved HTTPS tunnel at that address and configure only
`POST /webhooks/mercado-pago` as the Mercado Pago callback. Do not expose the
databases, RabbitMQ, WordPress, or internal service ports through the tunnel.

To prove fail-closed startup without revealing values, run Compose with
`PAYMENT_PROVIDER_MODE=mercado-pago` and either required secret empty; Payment
Federation must remain unhealthy. Normal credential-free E2E explicitly uses
the deterministic default.

## Credential-free gate

Run from the repository root before using the sandbox:

```sh
find test -maxdepth 1 -name '*.test.mjs' -print0 | \
  xargs -0 env NODE_ENV=test \
  TSX_TSCONFIG_PATH=apps/order-workflow-subgraph/tsconfig.app.json \
  node --import tsx --test --test-reporter=tap

corepack pnpm exec nx run @desafio-dev-backend-senior/payment-federation:test
```

No skipped or todo test is acceptable. The Java target runs through the pinned
Gradle container, so a host Gradle installation is not required. These tests
execute provider request mapping, idempotency headers, webhook rejection,
authoritative correlation, and refund behavior with the remote Mercado Pago
client isolated; they do not claim that a sandbox transaction occurred.

## Sandbox verification

Load every value below from the approved secret-bearing environment. Do not put
the values on a command line or in a checked-in `.env` file.

```text
MERCADO_PAGO_SANDBOX_CONFIRM=CREATE_AND_REFUND_TEST_PAYMENTS
MERCADO_PAGO_ACCESS_TOKEN=<secret>
MERCADO_PAGO_WEBHOOK_SECRET=<secret>
MERCADO_PAGO_SANDBOX_BEARER_TOKEN=<short-lived cart:write and orders:read token>
MERCADO_PAGO_SANDBOX_CARD_TOKEN=<client-tokenized approved test Card>
MERCADO_PAGO_SANDBOX_PAYMENT_METHOD_ID=<test Card payment method>
MERCADO_PAGO_SANDBOX_PAYER_EMAIL=<test payer email>
MERCADO_PAGO_SANDBOX_AMOUNT=<approved BRL test amount>
MERCADO_PAGO_SANDBOX_GRAPHQL_URL=https://<stage-host>/graphql
MERCADO_PAGO_SANDBOX_WEBHOOK_URL=https://<stage-host>/webhooks/mercado-pago
```

Run the opt-in target and redirect standard output to the approved evidence
location:

```sh
corepack pnpm exec nx run @desafio-dev-backend-senior/e2e:mercado-pago-sandbox \
  > "$APPROVED_REDACTED_EVIDENCE_PATH"
```

The target refuses to start without the exact confirmation and every input. It
always calls the official `https://api.mercadopago.com` API, requires HTTPS for
the deployed endpoints, and writes no remote response body or secret to output.
Its JSON evidence contains only timestamps, unique operation keys, SHA-256
reference fingerprints, statuses, and zero exit results.

The verifier automates the following checks:

1. Create a Card payment with a client-generated test token, payer email, and
   Mercado Pago payment-method identifier. Confirm the stored reference is the
   provider response. Submit the same logical command again with the same
   operation key and confirm no second provider payment exists.
2. Create a BRL Pix payment. Confirm the stored reference and copy-and-paste
   code exactly match Mercado Pago's response. Do not treat code generation as
   settlement or expect an inventory reservation.
3. Send a webhook with an invalid signature and confirm HTTP 401 with no local
   payment-state change.
4. Deliver a correctly signed notification. Confirm the service fetches the
   resource with server credentials. Replay the same `x-request-id` and confirm
   the local payment remains at the single authoritative transition.
5. For an approved Card payment, request a refund using its persisted provider
   reference. Replay the refund command with its original operation key and
   confirm one provider refund; accept local `REFUNDED` only after authoritative
   lookup returns the refunded status.

## Recovery

- For a creation timeout, retain the original operation key. Never generate a
  replacement key or manually create another payment. Redeliver the original
  command and correlate the returned provider reference before changing state.
- For delayed or reordered webhooks, query Mercado Pago by the persisted
  provider reference. Do not edit the local status from webhook body fields.
- For repeated notifications, inspect the inbox outcome by provider request id.
  Replay only after the original transaction outcome is understood.
- For refund ambiguity, retain both the original payment reference and refund
  operation key. Do not mark the payment refunded from a timeout response.

If Mercado Pago is unavailable, stop new production payment intake through the
approved operational control and let existing operations remain pending. Never
switch production to the deterministic provider.

## Evidence and cleanup

Store a redacted summary outside application logs. Do not store request or
response bodies, authorization headers, provider tokens, webhook signatures,
payer documents, or secrets. Remove temporary callback routes, revoke temporary
test credentials, and verify that no secret-bearing shell history or files
remain after the exercise.
