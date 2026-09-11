# Tasks: Restore bearer-owned cart

> feature: restore-bearer-owned-cart

## T-308 — Resolve the native WooCommerce cart from the OAuth subject [pendente]

- Refs: US-161, AC-357, AC-358
- Arquivos: libs/gateway/nest/src/application/ports/wordpress-credential.port.ts, libs/gateway/nest/src/infrastructure/http/wp-graphql-credential.adapter.ts, libs/gateway/nest/src/infrastructure/http/wp-graphql-credential.adapter.spec.ts, libs/gateway/nest/src/gateway-path.integration.spec.ts, compose.yaml, .spec/features/restore-bearer-owned-cart, .spec/verification/restore-bearer-owned-cart.json
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notes: Bounded context: Edge federation composition. Use case: exchange the verified OAuth principal subject for a short-lived native WordPress credential and use it only on the downstream WordPress request. Aggregate: none; Edge owns no business state. Invariants: the client sends only its OAuth bearer; different subjects remain isolated; WordPress credentials never leave the backend or logs; no process-local subject-to-session map is introduced. Consistency boundary: one authenticated Gateway request delegated to the WordPress-owned cart. Affected ports: federation request preparation and a WordPress credential-exchange port. Reuse the existing native SITETOKEN login and linked `better_auth_user_id`. Follow Red, Green, Refactor with the smallest regression and isolation tests, then run the required quality, verify, and audit gates.
