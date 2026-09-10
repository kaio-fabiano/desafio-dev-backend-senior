# T-272 — OAuth audience and DPoP presentation guidance

## Client-facing contract

- Gateway-only operations require the Gateway audience.
- Gateway-to-Identity federated operations require the Identity audience as applicable.
  A flow that calls both resource servers must request both audiences.
- Bearer OAuth is delivered.
- DPoP transport is prepared/implemented, but production support depends on the canonical
  external Gateway origin and a shared replay store. `htu` must match the effective request
  URI, `htm` must match the method, and replayed `jti` values must be rejected. DPoP is not
  required for current clients.

## Resolved Identity findings

- `users` requires `identity:users:read`.
- `user(id)` is available to the authenticated subject for self lookup or an administrator;
  denied cross-user reads return `null`.
- The production request-scoped batch provider is tested, legacy aliases are removed, and
  `hasPreviousPage` is based on persisted rows.

Checkout card credential propagation (T-273) is resolved: the asynchronous workflow preserves
the exact tokenized Card credentials without carrying raw Card data.
