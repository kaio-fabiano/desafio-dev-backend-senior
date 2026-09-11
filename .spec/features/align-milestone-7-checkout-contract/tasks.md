# Tasks: Align milestone 7 checkout contract

> feature: align-milestone-7-checkout-contract

## T-303 — Align Gateway and E2E checkout operation shapes [pendente]
- Refs: US-158, AC-352
- Arquivos: libs/contracts/graphql/order-workflow/schema.graphql, apps/e2e/src/journey.ts, apps/e2e/src/milestone-7.e2e.test.ts, test/milestone-7-e2e-contract.test.mjs
- Modelo: gpt-5.6-sol
- Esforço: alto
- Notas: Red records the current operation-shape mismatch. Green updates the static SDL and the existing acceptance client only. Refactor keeps the terminal SSE event as the synchronization boundary and performs one federated order read after completion.
