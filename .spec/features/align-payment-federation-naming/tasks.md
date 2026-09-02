# Tasks: Align Payment Federation naming

> feature: align-payment-federation-naming

## T-116 — Define executable naming boundaries [concluida]

- Refs: US-074, AC-152, AC-153, US-075, AC-154
- Arquivos: test/align-payment-federation-naming.spec.test.mjs
- Modelo: gpt-5.6-terra
- Esforço: medio

## T-117 — Rename the Java runtime and active references [concluida]

- Refs: US-074, AC-152, AC-153
- Arquivos: apps/payment-federation, apps/e2e, compose.yaml, infra/sst.config.ts, libs/contracts/graphql/supergraph.yaml, libs/gateway/nest/src/gateway.module.ts, package.json, test
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notes: Preserve Java packages and versioned AMQP identifiers.

## T-118 — Remove the retired contract and align documentation [concluida]

- Refs: US-075, AC-154
- Arquivos: README.md, docs
- Modelo: gpt-5.6-luna
- Esforço: baixo

## T-119 — Make WordPress plugin bootstrap idempotent [concluida]

- Refs: US-076, AC-155
- Arquivos: apps/wordpress-integration/scripts/install-plugins.sh, docs/adrs/003-wordpress-federation.md, test/align-payment-federation-naming.spec.test.mjs
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notes: Validate exact plugin versions locally; production must use a prebuilt immutable image.

## T-121 — Rename the undeployed payment queue [concluida]

- Refs: US-074, AC-157
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/payment/adapter/messaging/PaymentRuntimeConfiguration.java, test/delivery-closure-inventory-saga.test.mjs, test/align-payment-federation-naming.spec.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notes: Rename only the queue namespace; preserve the event type, exchange, retry behavior, and delivery semantics.
