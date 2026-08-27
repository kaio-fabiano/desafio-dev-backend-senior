# Deployment runbook

Deployment is performed only from an approved, credentialed environment. CI validates the pinned SST v3 configuration and produces a reviewable diff; it does not receive production credentials from the repository.

```sh
corepack pnpm exec sst diff --stage <stage>
corepack pnpm exec sst deploy --stage <stage>
```

Set provider credentials through the approved CI secret store or local credential helper. Confirm the stage and diff with the owner before deploying. Do not use production stages for experiments, and never commit credentials, tokens, generated state, or diff output containing sensitive values. Roll back through the provider’s reviewed versioned deployment mechanism.
