# T-308 implementation record

- Bounded context: Edge federation composition.
- Use case: exchange the verified OAuth principal subject for a short-lived
  native WordPress credential before a WordPress federation request.
- Aggregate: none; Edge owns no business state.
- Invariants: the client supplies only its OAuth bearer; WordPress credentials
  remain server-side; subjects resolve isolated native carts; no process-local
  subject-to-session state exists.
- Consistency boundary: one authenticated Gateway request delegated to the
  WordPress-owned cart.
- Affected ports: federation request preparation and the WordPress credential
  exchange port.

## Red

`pnpm exec vitest run libs/gateway/nest/src/gateway-path.integration.spec.ts`
failed on 2026-09-11 with AC-357 and AC-358 because the downstream WordPress
cart operations had no credential derived from `principal.subject`, so both
responses contained no `data`.

## Green

The Gateway now exchanges `principal.subject` through WPGraphQL Headless Login
SITETOKEN for each WordPress request and sends the returned credential only as
the downstream `Authorization` header. WordPress session response forwarding is
disabled for this route.

## Refactor and verification

- Focused AC-357 and AC-358 integration tests: pass.
- Focused critical-path coverage: 100% statements, branches, functions, and
  lines.
- Gateway Nx test target: pass, 54 Vitest tests and 6 Node contract tests.
- Gateway production and test typechecks: pass.
- Gateway lint: pass.
- Gateway strict DDD architecture check: pass.
- Compose configuration validation: pass.
- `onp-spec verify` is blocked by the pre-existing AC-298 failure in
  `gateway-auth.module.ts` and `dynamo-dpop-replay.store.ts`.
- `onp-spec audit --ci` is blocked by the repository's existing global audit
  debt; the feature's new production files are mapped by T-308.
