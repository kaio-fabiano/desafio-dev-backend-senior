# TDD evidence

## T-270 — Propagate the short-lived Card credential through choreography

- Red command: `cd apps/payment-federation && ./gradlew test --tests 'dev.desafio.transaction.transaction.checkout.CheckoutServiceTest.cardCheckoutPreservesProviderCredentialsInStartTransaction'`
- Red result: exited 1; the focused `@spec:AC-306` regression compiled and failed at `CheckoutServiceTest.java:68` because the dispatched `StartTransaction` omitted `providerToken` (expected `provider-token`, actual empty field).
- Green command: `cd apps/payment-federation && ./gradlew test --tests 'dev.desafio.transaction.transaction.checkout.CheckoutServiceTest.cardCheckoutPreservesProviderCredentialsInStartTransaction'`
- Green result: exited 0 (`BUILD SUCCESSFUL`); production and test compilation succeeded, and the focused regression passed after propagating the exact Card values into `StartTransaction`.
- Refactor command: `cd apps/payment-federation && ./gradlew test --tests 'dev.desafio.transaction.transaction.checkout.CheckoutServiceTest' --tests 'dev.desafio.transaction.transaction.application.TransactionAxonTest' --tests 'dev.desafio.transaction.transaction.application.TransactionProjectionTest' --tests 'dev.desafio.transaction.inventory.application.InventoryAxonPathsTest' --tests 'dev.desafio.transaction.inventory.application.InventoryIntegrationEventHandlerTest'`
- Refactor result: exited 0 (`BUILD SUCCESSFUL`); the directly affected checkout, Transaction, and Inventory test classes passed after replacing the temporary JSON assertions with typed record accessors. No global Node tests, full repository suite, unrelated coverage, `onp-spec verify`, or `onp-spec audit --ci` command was run, as those feature gates are delegated to the orchestrator.
