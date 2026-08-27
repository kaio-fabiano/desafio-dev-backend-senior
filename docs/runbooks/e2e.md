# End-to-end runbook

The E2E acceptance target owns the lifecycle: it starts the isolated Compose environment, obtains short-lived test credentials, runs the buyer checkout journey, and tears the environment down.

```sh
corepack pnpm exec nx run @desafio-dev-backend-senior/e2e:acceptance
```

If the target is unavailable, validate the contract and run the focused suite from the repository root:

```sh
corepack pnpm test:spec -- test/milestone-7-e2e-contract.test.mjs
```

The journey covers registration, scoped Gateway/MCP access, idempotent card checkout, stable Pix output, and rejection of missing, wrong-audience, or under-scoped requests. Never paste bearer tokens, client secrets, or authorization headers into logs or evidence.
