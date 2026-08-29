# Federated platform refactor handoff

## Saved state

- Branch: `spec/federated-platform-architecture-refactor`
- Implementation checkpoint stash: `codex-checkpoint-federated-refactor-before-os-shutdown`
- IDE-only `apps/identity-subgraph/src/main.ts` stash:
  `codex-preserve-ide-main-before-os-shutdown`
- Earlier safety stashes must remain untouched until the refactor is verified.

## Completed but not yet committed

- Gateway composes Identity, WordPress, and Payment only.
- Nx and Compose expose five deployable applications plus the E2E project.
- Commerce and Stock are retired from active build and runtime targets.
- RabbitMQ is removed from the active topology and Payment runtime.
- Payment command/query evidence covers CQRS and idempotency.
- WordPress Federation owns GraphQL-over-SSE using the NestJS
  `GraphQLSchemaHost` executable schema.
- The direct SSE endpoint validates the OAuth Bearer token and rejects forged
  propagated identity headers.
- The E2E client uses the explicit WordPress checkout followed by the Payment
  authorization operation.

## Open architecture decision

Payment does not currently communicate a terminal `COMPLETED` or
`PIX_GENERATED` transition to WordPress Federation. Do not restore RabbitMQ,
add an unauthenticated ingress endpoint, or synthesize the event in the E2E
test.

Recommended continuation: validate the native WooGraphQL order-update mutation
against the installed plugin schema, then let the acceptance client explicitly
coordinate Payment authorization followed by the owning WordPress order
transition. The WordPress Federation provider should observe that native
transition and publish it to the already-open SSE stream. If the native plugin
cannot represent the required transition, record the capability gap before
adding the smallest authenticated, versioned extension.

## Required continuation sequence

1. Restore the implementation checkpoint stash only.
2. Inspect the installed WPGraphQL for WooCommerce schema for the native order
   update operation; do not guess its input or payload.
3. Complete the WordPress transition source and the Card/Pix E2E assertions.
4. Update superseded Milestone 4 tests so they prove RabbitMQ, Commerce, and
   Stock are archived rather than active. Never weaken their behavioral
   assertions merely to pass the gate.
5. Run focused TypeScript, NestJS, Spring, GraphQL composition, Compose, and E2E
   checks.
6. Run `onp-spec verify federated-platform-architecture-refactor`.
7. Run `onp-spec audit --ci`; resolve stale proofs for earlier features.
8. Suggest mechanically supported lessons learned.
9. Review and split the checkpoint into conventional commits. Do not commit a
   false green state.
10. Restore the IDE-only stash after the implementation is stable, resolving
    import-order conflicts without discarding the user's edit.

The feature is not complete until both the verify command and CI audit exit
with code zero.
