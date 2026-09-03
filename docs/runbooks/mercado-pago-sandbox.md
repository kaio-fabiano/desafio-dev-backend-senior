# Mercado Pago sandbox runbook

This procedure is opt-in. It moves test money against Mercado Pago and requires
external test credentials plus an HTTPS callback reachable by Mercado Pago.
The normal repository gate remains credential-free.

## Preconditions

- Java 21, Docker, Node.js 24, Corepack, and repository dependencies are
  available.
- A Mercado Pago test account supplies an access token and webhook secret
  through an approved secret store. Never commit them or paste them into logs,
  screenshots, issue comments, shell history, or evidence files.
- The public callback forwards only to
  `POST /webhooks/mercado-pago`; its TLS endpoint and tunnel logs are controlled.
- Card input is rendered and tokenized by Mercado Pago.js or Bricks. Only the
  returned short-lived `providerToken` reaches this platform. Never send PAN,
  expiry, cardholder document, or security-code fields to GraphQL or RabbitMQ.

Configure the runtime from the secret-bearing execution environment:

```text
PAYMENT_PROVIDER_MODE=mercado-pago
MERCADO_PAGO_ACCESS_TOKEN=<secret-store reference>
MERCADO_PAGO_WEBHOOK_SECRET=<secret-store reference>
MERCADO_PAGO_API_BASE_URL=https://api.mercadopago.com
MERCADO_PAGO_CONNECTION_TIMEOUT=5s
MERCADO_PAGO_READ_TIMEOUT=15s
```

Do not place real secret values in `.env` files. An empty, malformed, or
non-official endpoint must prevent startup. Deterministic mode is valid only in
the `local` or `test` profile and is not a production fallback.

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

Use unique, recorded operation keys for the following checks. Evidence records
the timestamp, operation key, sanitized provider reference, terminal status,
and command exit status only.

1. Create a Card payment with a client-generated test token, payer email, and
   Mercado Pago payment-method identifier. Confirm the stored reference is the
   provider response. Submit the same logical command again with the same
   operation key and confirm no second provider payment exists.
2. Create a BRL Pix payment. Confirm the stored reference and copy-and-paste
   code exactly match Mercado Pago's response. Do not treat code generation as
   settlement or expect an inventory reservation.
3. Send a webhook with an invalid signature and confirm HTTP 401 with no inbox,
   payment, or outbox change.
4. Let Mercado Pago deliver a valid notification. Confirm the service fetches
   the resource with server credentials. Replay the same `x-request-id` and
   confirm one financial transition and one outbox event.
5. Interrupt the response after a create request reaches Mercado Pago. Redeliver
   the command with the original operation key and confirm the stored result is
   recovered without a distinct payment.
6. For an approved Card payment, request a refund using its persisted provider
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
