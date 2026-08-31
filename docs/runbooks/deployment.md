# Deployment runbook

Deployment is performed only from an approved, credentialed environment. Pull-request CI validates the pinned SST v3 TypeScript configuration offline and never provisions or diffs AWS resources. A reviewable infrastructure diff is an explicit, separately authorized step; CI does not receive production credentials from the repository.

```sh
corepack pnpm exec sst diff --stage <stage>
corepack pnpm exec sst deploy --stage <stage>
```

Run `sst diff` only after credentials and an explicit review authorization are available. Set provider credentials through the approved CI secret store or local credential helper. Confirm the stage and diff with the owner before deploying. Do not use production stages for experiments, and never commit credentials, tokens, generated state, or diff output containing sensitive values. Roll back through the provider’s reviewed versioned deployment mechanism.
