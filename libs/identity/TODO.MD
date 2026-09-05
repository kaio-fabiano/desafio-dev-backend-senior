### Resolved — Align the identity-nest Nx test target with test ownership

The identity-nest target runs co-located Vitest specs and every focused root
TAP test that imports identity behavior. Those root test files and the package,
lockfile, TypeScript, and Vitest configuration inputs are explicit Nx inputs.
T-183 records cache miss/hit/miss verification in
`docs/evidence/node-review/T-183.md`. Inferred lint and typecheck targets
remain unchanged.
