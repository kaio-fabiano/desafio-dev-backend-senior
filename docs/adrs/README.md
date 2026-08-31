# Architecture decision records

This directory records decisions made from the Milestone 0 compatibility
proofs. Each ADR includes the context, alternatives or experiment, decision,
consequences, and reproducible evidence.

## Index

| ADR                                                                     | Decision                                                                | Status                      |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------- |
| [001 — GraphQL subscriptions over SSE](001-graphql-sse-federado.md)     | Use a hybrid federated GraphQL/SSE edge                                 | Accepted for implementation |
| [002 — OAuth multi-resource token](002-oauth-multi-resource.md)         | Bind one JWT to both resource audiences and validate each independently | Accepted                    |
| [003 — WordPress federation](003-wordpress-federation.md)               | Use the indicated plugins with minimal SDL normalization                | Accepted for the proof      |
| [004 — Delivery constraints](004-restricoes-de-entrega.md)              | Pin SST v3 and use the owner-confirmed 2026-09-03 date                  | Accepted                    |
| [005 — Persistence and polyglot Nx](005-persistence-and-polyglot-nx.md) | Use MikroORM and integrate the Java processor through Nx                | Accepted for implementation |

## Maintenance

When a proof closes a decision, add or update its ADR with the evaluated
versions or commits, reproduction command, evidence, adopted decision, and
consequences. Update the affected risk register in the same change.
