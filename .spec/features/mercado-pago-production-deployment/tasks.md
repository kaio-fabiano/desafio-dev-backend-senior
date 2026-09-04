# Tasks: Mercado Pago production deployment

> feature: mercado-pago-production-deployment

## T-146 — Run and repair the complete credential-free quality gate [concluida]

- Refs: US-094, AC-187, AC-188
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: package.json, apps/e2e/project.json, test/mercado-pago-production-deployment.test.mjs, docs/evidence/mercado-pago-production-deployment/credential-free-gate.md
- Notas: Run all existing suites first, make only root-cause fixes required by failures, reject skipped tests, and record the exact Git revision and commands.

## T-147 — Automate redacted Mercado Pago test-environment verification [concluida]

- Refs: US-095, AC-189, AC-190
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: apps/e2e/src/mercado-pago-sandbox.test.ts, apps/e2e/src/mercado-pago-sandbox.ts, apps/e2e/project.json, docs/runbooks/mercado-pago-sandbox.md, test/mercado-pago-production-deployment.test.mjs
- Notas: Keep the credentialed target opt-in, require explicit environment inputs, use unique operation keys, never print secrets or raw payloads, and verify no second provider operation is created.

## T-148 — Complete secret-backed SST runtime and deployment checks [concluida]

- Refs: US-096, AC-191, AC-192
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: infra/sst.config.ts, infra/package.json, apps/payment-federation/Dockerfile, apps/order-workflow-subgraph/Dockerfile, apps/gateway/Dockerfile, apps/identity-subgraph/Dockerfile, apps/apollo-mcp/Dockerfile, test/mercado-pago-production-deployment.test.mjs, docs/runbooks/deployment.md
- Notas: Represent the complete required topology, bind managed secrets to Payment Federation, expose only required entry points, validate and diff before any deploy, and preserve production protection.

## T-149 — Deploy the approved stage and run release smoke tests [concluida]

- Refs: US-095, US-096, AC-189, AC-190, AC-192, AC-193
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: docs/evidence/mercado-pago-production-deployment/deployment.json, docs/evidence/mercado-pago-production-deployment/provider-sandbox.json, docs/evidence/mercado-pago-production-deployment/smoke-test.md
- Notas: This task starts only after the owner approves the exact stage and reviewed SST diff. Store redacted evidence, execute the credentialed provider checks, and roll back on a critical smoke failure.

## T-150 — Add a safe local environment template [concluida]

- Refs: US-095, US-096, AC-189, AC-192
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Arquivos: .gitignore, .env.example, docs/runbooks/deployment.md
- Notas: Ignore every local `.env` file, version placeholders only, default the documented stage to `sandbox`, and document loading the configured AWS profile plus syncing secrets to the SST secret store without printing values.

## T-151 — Enable real Mercado Pago mode in local Compose [concluida]

- Refs: US-095, AC-189, AC-190
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: compose.yaml, test/mercado-pago-production-deployment.test.mjs, docs/runbooks/mercado-pago-sandbox.md
- Notas: Forward only the required provider configuration from the ignored local environment into Payment Federation, preserve deterministic defaults when explicitly selected, document discovery of the random host port for an HTTPS tunnel, and prove missing real-provider inputs fail closed.

## T-152 — Fix Mercado Pago webhook controller injection [concluida]

- Refs: US-095, AC-189
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/payment/adapter/mercadopago/MercadoPagoWebhookController.java, apps/payment-federation/src/test/java/dev/desafio/transaction/payment/adapter/mercadopago/MercadoPagoWebhookControllerTest.java
- Notas: Mark the production constructor as the Spring injection point, add a regression test that starts the controller in real-provider mode, and rebuild Payment Federation before resuming the local sandbox verification.

## T-153 — Generate local sandbox bearer securely [concluida]

- Refs: US-095, AC-189
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: apps/e2e/src/journey.ts, apps/e2e/src/sandbox-bearer.ts, apps/e2e/src/sandbox-bearer.test.ts, apps/e2e/project.json, apps/identity-subgraph/src/auth/config.ts, apps/identity-subgraph/src/auth/seed.ts, libs/identity/nest/src/auth/better-auth.factory.ts, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/configuration/PaymentSecurityConfiguration.java, apps/payment-federation/src/main/resources/application.yaml, test/milestone-6-mcp-oauth.test.mjs, test/mercado-pago-production-deployment.test.mjs, docs/runbooks/mercado-pago-sandbox.md
- Notas: Reuse the existing OAuth PKCE flow, request only the scopes required by sandbox payments, validate the JWT grant, and update the ignored local environment without printing the bearer token.

## T-154 — Use real WooCommerce orders in sandbox verification [concluida]

- Refs: US-095, AC-189, AC-190
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: .env.example, apps/e2e/src/mercado-pago-sandbox.ts, apps/e2e/src/mercado-pago-sandbox.test.ts, apps/payment-federation/src/main/java/dev/desafio/transaction/payment/adapter/mercadopago/MercadoPagoPaymentProvider.java, apps/payment-federation/src/test/java/dev/desafio/transaction/payment/adapter/mercadopago/MercadoPagoPaymentProviderTest.java, docs/runbooks/mercado-pago-sandbox.md, test/mercado-pago-production-deployment.test.mjs
- Notas: Resolve valid WooCommerce order identifiers before provider authorization, preserve operation idempotency across retries, avoid duplicate provider payments after partial failures, and keep all evidence redacted.

## T-156 — Build an immutable production WordPress runtime [concluida]

- Refs: US-096, AC-191
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: apps/wordpress-integration/Dockerfile, apps/wordpress-integration/scripts/production-entrypoint.sh, infra/sst.config.ts, test/mercado-pago-production-deployment.test.mjs
- Notas: Reuse the pinned local plugin set, bootstrap WordPress idempotently, create only service credentials supplied through SST secrets, and make readiness depend on completed setup.

## T-157 — Synchronize sandbox secrets and generate the reviewed SST diff [concluida]

- Refs: US-096, AC-191, AC-192
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: docs/evidence/mercado-pago-production-deployment/predeploy.md
- Notas: Generate missing non-provider secrets locally, keep values out of files and logs, set every secret for stage sandbox, validate the clean revision, and record the redacted diff digest and cost surface for explicit approval.

## T-158 — Accept official Mercado Pago webhook timestamp formats [concluida]

- Refs: US-095, AC-163, AC-189
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/payment/adapter/mercadopago/MercadoPagoWebhookController.java, apps/payment-federation/src/test/java/dev/desafio/transaction/payment/adapter/mercadopago/MercadoPagoWebhookControllerTest.java
- Notas: Keep SDK HMAC verification, enforce the five-minute replay window for both legacy epoch-second and current epoch-millisecond signatures, and prove both accepted and stale requests with real signatures.

## T-159 — Replace public load balancers with managed HTTPS routing [concluida]

- Refs: US-098, AC-195, AC-192, AC-193
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: infra/sst.config.ts, infra/package.json, apps/apollo-mcp/mcp.yaml, test/mercado-pago-production-deployment.test.mjs, docs/runbooks/deployment.md
- Notas: Use one API Gateway HTTP API with a VPC link and exact private routes, keep every ECS service on Cloud Map, publish the real OAuth issuer and MCP resource URL, remove service-owned ALBs, and retain the SST v3 approval gate.

## T-160 — Repair sandbox container startup and readiness [concluida]

- Refs: US-096, AC-191, AC-192, AC-193
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: infra/sst.config.ts, apps/apollo-mcp/Dockerfile, apps/wordpress-integration/scripts/production-entrypoint.sh, apps/order-workflow-subgraph/src/persistence/mikro-orm.config.ts, apps/order-workflow-subgraph/src/subscriptions/postgres-order-event.relay.ts, libs/identity/nest/src/auth/better-auth.factory.ts, apps/e2e/src/journey.ts, apps/e2e/src/sandbox-bearer.ts, apps/e2e/src/sandbox-bearer.test.ts, test/mercado-pago-production-deployment.test.mjs
- Notas: Fix the observed ECS startup failures at their source, preserve non-root containers where supported, prove database credentials are passed without stringifying secret outputs, keep durable broker data writable, permit sandbox bearer issuance only through HTTPS or loopback Identity endpoints, and require public health checks to succeed before release evidence is accepted.
