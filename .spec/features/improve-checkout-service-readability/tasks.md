# Tasks: Improve checkout service readability

> feature: improve-checkout-service-readability

## T-274 — Separate checkout coordination steps [em-andamento]
- Refs: US-146, AC-316
- Arquivos: apps/payment-federation/src/main/java/dev/desafio/transaction/transaction/checkout/CheckoutService.java, apps/payment-federation/src/test/java/dev/desafio/transaction/transaction/checkout/CheckoutServiceTest.java
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Bounded context: Transaction checkout coordination. Use case: idempotent checkout. Aggregate: none in this service; it coordinates the technical checkout operation and dispatches `StartTransaction`. Invariants: at most one WooCommerce order and one transaction per identical operation; deterministic conflict rejection; bounded lease wait; ambiguous WooCommerce creation is reconciled; payment credentials remain unchanged. Consistency boundary: lease-owned checkout operation state transitions. Affected ports: `CheckoutOperationRepository`, `WooCommerceOrderPort`, and `TransactionCommands`. This is a behavior-preserving refactor, so existing behavioral tests provide the Green baseline and no artificial Red failure will be introduced.

## T-275 — Expose checkout JUnit evidence to the TAP verifier [pendente]

- Refs: US-146, AC-316
- Arquivos: test/improve-checkout-service-readability.test.mjs
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Run the focused existing JUnit checkout suite and expose its generated XML through TAP; add no dependency or duplicate behavior assertion. This is a mechanical verification change and must not alter production behavior.
