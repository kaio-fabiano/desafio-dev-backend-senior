# Tasks: Federated platform architecture refactor

> feature: federated-platform-architecture-refactor
>
> Execution approval: the user explicitly confirmed the task plan, the model and
> effort assigned to every task, and parallel execution by waves. Task executors
> must proceed without requesting this confirmation again.

## T-065 — Lock the target architecture and executable boundaries [concluida]

- Refs: US-046, AC-090, AC-091, US-052, AC-103
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: docs/adrs/007-federated-platform-boundaries.md, docs/prds/01-arquitetura-e-dominio.md, docs/prds/02-graphql-federation.md, docs/prds/04-commerce-saga-e-realtime.md, test/architecture-boundaries.test.mjs, test/federated-platform-refactor.test.mjs
- Notas: Update stale planning before implementation. Encode allowed deployables and dependency directions without prescribing folder ceremony.

## T-066 — Extract NestJS composition libraries and provider contracts [concluida]

- Refs: US-047, AC-092, US-052, AC-103
- Modelo: gpt-5.6-terra
- Esforço: medio
- Arquivos: libs/platform/nest/src/config/config.module.ts, libs/platform/nest/src/config/environment.factory.ts, libs/platform/nest/src/lifecycle/resource.provider.ts, libs/platform/nest/src/index.ts, libs/platform/nest/project.json, libs/platform/nest/tsconfig.json, libs/platform/nest/tsconfig.lib.json, test/nest-provider-composition.test.mjs
- Notas: Add only providers shared by at least two NestJS applications. Do not create generic base services, repositories, or speculative factories.

## T-067 — Refactor Identity Federation around NestJSBetterAuth providers [concluida]

- Refs: US-047, AC-092, AC-093, AC-094, US-048, AC-096
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: apps/identity-subgraph/src/main.ts, apps/identity-subgraph/src/app.module.ts, libs/identity/nest/src/identity.module.ts, libs/identity/nest/src/auth/better-auth.factory.ts, libs/identity/nest/src/auth/better-auth.module.ts, libs/identity/nest/src/auth/plugins/jwt-plugin.factory.ts, libs/identity/nest/src/auth/plugins/oauth-provider-plugin.factory.ts, libs/identity/nest/src/auth/registration.service.ts, libs/identity/nest/src/graphql/identity.resolver.ts, libs/identity/nest/src/index.ts, libs/identity/nest/project.json, libs/identity/nest/tsconfig.json, libs/identity/nest/tsconfig.lib.json, test/identity-federation-refactor.test.mjs
- Notas: Use the installed `@thallesp/nestjs-better-auth` integration and its documented handler. Remove direct Pool construction, manual HTTP bridging, closure-based adapters, and the custom PostgreSQL user repository only after equivalent tests exist.

## T-068 — Reduce Gateway to authenticated federation composition [concluida]

- Refs: US-048, AC-095, AC-096
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: apps/gateway/src/main.ts, apps/gateway/src/app.module.ts, libs/gateway/nest/src/auth/auth-context.factory.ts, libs/gateway/nest/src/auth/token-verifier.service.ts, libs/gateway/nest/src/federation/authenticated-data-source.ts, libs/gateway/nest/src/gateway.module.ts, libs/gateway/nest/src/index.ts, libs/gateway/nest/project.json, libs/gateway/nest/tsconfig.json, libs/gateway/nest/tsconfig.lib.json, test/gateway-federation-refactor.test.mjs
- Notas: Remove catalog/order loaders and subscription proxy from the gateway. Authentication and safe identity propagation remain providers because they are edge responsibilities.

## T-069 — Build the thin WordPress Federation adapter [concluida]

- Refs: US-049, AC-097, AC-098, US-048, AC-096
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: apps/wordpress-federation/src/main.ts, apps/wordpress-federation/src/app.module.ts, apps/wordpress-federation/project.json, apps/wordpress-integration/compose.yaml, apps/wordpress-integration/scripts/install-plugins.sh, apps/wordpress-integration/scripts/publish-subgraph.mjs, libs/wordpress/nest/src/federation/wordpress-federation.module.ts, libs/wordpress/nest/src/federation/wpgraphql-client.service.ts, libs/wordpress/nest/src/federation/wpgraphql-auth.factory.ts, libs/wordpress/nest/src/index.ts, libs/wordpress/nest/project.json, libs/wordpress/nest/tsconfig.json, libs/wordpress/nest/tsconfig.lib.json, libs/contracts/graphql/wordpress/schema.graphql, test/wordpress-federation-refactor.test.mjs
- Notas: Start with WPGraphQL, WPGraphQL for WooCommerce, and federation plugin capabilities. Evaluate an established schema delegation library before custom remote execution. The NestJS adapter must not duplicate WPGraphQL loaders, Model Layer authorization, commercial repositories, or WooCommerce CRUD objects.

## T-070 — Refactor Payment as a Spring GraphQL Federation bounded context [concluida]

- Refs: US-050, AC-099, AC-100, AC-101, US-048, AC-096
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: apps/payment-processor/build.gradle.kts, apps/payment-processor/src/main/java/dev/desafio/payment/PaymentProcessorApplication.java, apps/payment-processor/src/main/java/dev/desafio/payment/domain/Payment.java, apps/payment-processor/src/main/java/dev/desafio/payment/application/command/AuthorizePayment.java, apps/payment-processor/src/main/java/dev/desafio/payment/application/command/AuthorizePaymentHandler.java, apps/payment-processor/src/main/java/dev/desafio/payment/application/query/FindPayment.java, apps/payment-processor/src/main/java/dev/desafio/payment/application/query/PaymentView.java, apps/payment-processor/src/main/java/dev/desafio/payment/application/query/FindPaymentHandler.java, apps/payment-processor/src/main/java/dev/desafio/payment/graphql/PaymentController.java, apps/payment-processor/src/main/java/dev/desafio/payment/configuration/PaymentConfiguration.java, apps/payment-processor/src/main/resources/graphql/payment.graphqls, apps/payment-processor/src/test/java/dev/desafio/payment/PaymentFederationTest.java, libs/contracts/graphql/payment/schema.graphql, test/payment-federation-refactor.test.mjs
- Notas: Use Spring GraphQL Federation support before custom federation code. Keep CQRS lightweight: explicit command/query handlers, no Axon or event sourcing.

## T-071 — Move order subscriptions outside the federation gateway [concluida]

- Refs: US-051, AC-102, US-048, AC-095
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: libs/wordpress/nest/src/subscriptions/order-event.resolver.ts, libs/wordpress/nest/src/subscriptions/order-event.service.ts, libs/wordpress/nest/src/subscriptions/subscription-auth.guard.ts, libs/wordpress/nest/src/subscriptions/graphql-sse.adapter.ts, libs/wordpress/nest/src/subscriptions/subscriptions.module.ts, libs/wordpress/nest/src/subscriptions/wordpress-checkout-event.source.ts, libs/wordpress/nest/src/federation/wpgraphql-client.service.ts, libs/wordpress/nest/src/federation/wordpress-federation.module.ts, libs/wordpress/nest/src/index.ts, test/order-subscription-refactor.test.mjs
- Notas: Preserve GraphQL-over-SSE. After Nest initialization, obtain the executable Apollo schema through `GraphQLSchemaHost` and pass the same instance to the official `graphql-sse` handler. Do not rebuild or fetch a second schema, and do not proxy the stream through the gateway.

## T-072 — Integrate the federated topology and retire the Stock runtime [concluida]

- Refs: US-046, AC-090, US-049, AC-098, US-050, AC-099
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: package.json, nx.json, tsconfig.base.json, compose.yaml, libs/contracts/graphql/supergraph.yaml, apps/identity-subgraph/project.json, apps/payment-processor/project.json, apps/gateway/project.json, apps/apollo-mcp/project.json, apps/e2e/src/environment.ts, test/five-app-topology.test.mjs
- Notas: Run after T-067 through T-071. Rename projects only where the migration remains reviewable; remove Commerce/Stock and MikroORM dependencies only after replacement acceptance tests pass.

## T-073 — Prove quality and document the architecture walkthrough [concluida]

- Refs: US-052, AC-103
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: README.md, docs/knowledge/Mapa do Projeto.md, docs/runbooks/local-development.md, docs/runbooks/e2e.md, docs/evidence/federated-platform-refactor/review.md, test/federated-platform-quality.test.mjs
- Notas: Run last. Explain DDD boundaries, selective CQRS, DI/provider composition, federation ownership, omitted MikroORM, and why existing libraries were selected before custom code.

## T-074 — Replace the custom WordPress identity bridge with standard session exchange [concluida]

- Refs: US-048, AC-096, US-049, AC-097
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: apps/wordpress-integration/scripts/install-plugins.sh, compose.yaml, libs/identity/nest/src/auth/plugins/oauth-provider-plugin.factory.ts, libs/identity/nest/src/auth/registration.service.ts, libs/gateway/nest/src/federation/authenticated-data-source.ts, libs/wordpress/nest/src/federation/wpgraphql-auth.factory.ts, test/identity-federation-refactor.test.mjs, test/gateway-federation-refactor.test.mjs, test/wordpress-federation-refactor.test.mjs
- Notas: Install and pin WPGraphQL Headless Login, configure Better Auth as the sole OAuth/OIDC provider, and use the plugin-issued WordPress/WooCommerce session instead of custom HMAC identity headers. Preserve independent WordPress authorization and never expose the Site Token to clients.

## T-075 — Replace custom order and payment GraphQL operations with native owner APIs [concluida]

- Refs: US-049, AC-097, AC-098, US-050, AC-100, AC-101
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: apps/e2e/src/journey.ts, apps/payment-processor/src/main/java/dev/desafio/payment, libs/contracts/graphql/wordpress/schema.graphql, libs/wordpress/nest/src/federation/wpgraphql-client.service.ts, test/payment-federation-refactor.test.mjs, test/wordpress-federation-refactor.test.mjs, test/milestone-7-e2e-contract.test.mjs
- Notas: Use WooGraphQL checkout/order fields for buyer operations and the authenticated WooCommerce REST owner API for service-side payment transitions. Buyers must never be able to mark their own order paid. Keep Payment idempotency in the Payment bounded context.

## T-076 — Feed order subscriptions from native WooCommerce webhooks [concluida]

- Refs: US-051, AC-102, US-048, AC-096
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: compose.yaml, libs/wordpress/nest/src/subscriptions/wordpress-checkout-event.source.ts, libs/wordpress/nest/src/subscriptions/subscriptions.module.ts, libs/wordpress/nest/src/subscriptions/subscription-auth.guard.ts, test/order-subscription-refactor.test.mjs, test/milestone-7-e2e-contract.test.mjs
- Notas: Configure a signed native WooCommerce order webhook to an internal NestJS endpoint and publish authorized GraphQL-over-SSE events from it. Remove coupling to custom mutation names and preserve cleanup, isolation, and terminal-event semantics.

## T-077 — Delete the marketplace MU-plugin and prove the plugin-first topology [concluida]

- Refs: US-049, AC-097, AC-098, US-052, AC-103
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: apps/wordpress-integration/compose.yaml, apps/wordpress-integration/scripts/probe.mjs, compose.yaml, libs/contracts/graphql/wordpress/schema.graphql, test/milestone-8-wordpress-inventory-plugin.test.mjs, test/wordpress-federation-refactor.test.mjs, test/five-app-topology.test.mjs, test/federated-platform-quality.test.mjs
- Notas: Remove the custom GraphQL types, order/payment mutations, identity filter, API-key authentication, and inventory route. Prove that WPGraphQL, WooGraphQL, WPGraphQL Federations, Headless Login, WooCommerce REST, and native webhooks cover every retained capability.

## T-078 — Re-run acceptance and publish the native-plugin walkthrough [concluida]

- Refs: US-052, AC-103
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Arquivos: README.md, docs/knowledge/Mapa do Projeto.md, docs/runbooks/local-development.md, docs/runbooks/e2e.md, docs/evidence/federated-platform-refactor/review.md, .spec/verification/federated-platform-architecture-refactor.json
- Notas: Run after T-074 through T-077. Document the OIDC login exchange, native WooGraphQL and REST ownership, webhook-to-SSE path, removed custom PHP, and final executable evidence.

## T-079 — Restore clean-install TypeScript and Nx boundary compliance [concluida]

- Refs: US-052, AC-103
- Modelo: gpt-5.6-terra
- Esforço: medio
- Arquivos: package.json, pnpm-lock.yaml, tsconfig.base.json, tsconfig.json, eslint.config.mjs, compose.yaml, apps/gateway/Dockerfile, apps/gateway/src/app.module.ts, apps/gateway/src/main.ts, apps/identity-subgraph/Dockerfile, apps/identity-subgraph/src/app.module.ts, apps/identity-subgraph/src/main.ts, apps/payment-processor/project.json, apps/wordpress-federation/src/app.module.ts, apps/wordpress-federation/src/main.ts, libs/platform/nest/tsconfig.lib.json, libs/wordpress/nest/src/subscriptions/woocommerce-webhook.controller.ts, test/gateway-federation-refactor.test.mjs, test/identity-federation-refactor.test.mjs
- Notas: Add only the missing installed type declaration and replace cross-project relative imports with the existing workspace-scoped package entry points. Do not weaken Nx boundary rules or TypeScript strictness.

## T-080 — Re-run the pull-request gates and merge into main [concluida]

- Refs: US-052, AC-103
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Arquivos: .spec/verification/federated-platform-architecture-refactor.json, docs/evidence/federated-platform-refactor/review.md
- Notas: Run after T-079. Reproduce the clean-install Nx quality command, run the feature verify and CI audit, push the evidence, wait for GitHub checks, and merge PR #2 only when all required checks pass.
