# ADR 004 — Delivery constraints and pinned platform versions

- Status: accepted
- Date: 2026-08-26
- Decision owner: delivery owner

## Context

The challenge README requires SST v3 and historically states a deadline of
08/07/2026 at 12:00 BRT. The owner subsequently confirmed nine calendar days
from 2026-08-25, establishing 2026-09-03 as the deadline date. The delivery
deadline is date-only and must not inherit a time or timezone from the historical value.

## Decision

Keep SST on the v3 line until the owner explicitly authorizes a migration. The
confirmed deadline is **2026-09-03**, expressed as a date only. Do not describe
the old 08/07/2026 12:00 BRT timestamp—or any other time or timezone—as part of
the active deadline.

The compatibility proofs remain pinned to these evaluated versions or commits:

- GraphQL SSE: `@apollo/gateway@2.14.4`, `@apollo/subgraph@2.14.4`,
  `graphql@16.11.0`, `graphql-sse@2.6.1` (ADR 001).
- OAuth: `better-auth@1.7.1`, `@better-auth/oauth-provider@1.7.1` (ADR 002).
- WordPress: WordPress `6.8.2-php8.3-apache`, WooCommerce `10.4.3`, WPGraphQL
  `2.20.0`, GraphQL for eCommerce `1.0.3`, `wp-graphql-federations`
  `ac480974ceb6a1680410f955005e060056f150da`, Rover `0.41.0`, Federation
  composition `2.15.2` (ADR 003).

## Evidence

Reproduce the proofs with the commands documented in ADRs 001–003 and run:

```bash
node --test --test-reporter=tap test/marco-0-decisions.test.mjs
```

The acceptance test checks that each proof ADR contains its pins, command,
evidence, and decision, and that this deadline interpretation is explicit.

## Consequences

- Dependency upgrades require a new compatibility proof or an explicit ADR update.
- Scheduling can use 2026-09-03 as the complete deadline commitment.
- SST migration remains a product-owner decision, not an implementation detail.
