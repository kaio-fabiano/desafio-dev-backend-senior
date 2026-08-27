# Milestone 2 identity and catalog gate

Install the pinned workspace dependencies, keep Docker available for the prior
WordPress and foundation proofs, then run from the repository root:

```bash
export PATH=/home/kaiosilva/.local/share/fnm/node-versions/v24.19.0/installation/bin:$PATH
node .agents/skills/onp-spec-driven/scripts/onp-spec.mjs verify milestone-2-identity-catalog
node .agents/skills/onp-spec-driven/scripts/onp-spec.mjs audit --ci
```

The gate proves OAuth discovery/JWKS and idempotent client seeding, protected
resource claims, token-derived `me`, consistent WordPress registration,
supplier-company ownership, native Woo cursor pagination, and request-scoped
product batching. A failure in any command leaves the milestone unaudited.
