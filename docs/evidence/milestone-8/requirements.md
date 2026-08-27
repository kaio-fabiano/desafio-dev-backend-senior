# Milestone 8 evidence matrix

This matrix records the evidence required for the compliance gate. Runtime
criteria remain red until the delivered applications provide protocol-level
proof; source-shape checks are not substitutes for those proofs.

| Criterion | Required evidence | Status |
|---|---|---|
| AC-078 | [Real E2E test](../../../test/milestone-8-real-e2e.test.mjs) | pending T-058 |
| AC-079 | [Real E2E test](../../../test/milestone-8-real-e2e.test.mjs) | pending T-058 |
| AC-080 | [Identity runtime test](../../../test/milestone-8-identity-gateway.test.mjs) | pending T-055 |
| AC-081 | [Identity runtime test](../../../test/milestone-8-identity-gateway.test.mjs) | pending T-055 |
| AC-082 | [Identity runtime test](../../../test/milestone-8-identity-gateway.test.mjs) | pending T-055 |
| AC-083 | [Commerce runtime test](../../../test/milestone-8-commerce-runtime.test.mjs) | pending T-056 |
| AC-084 | [Worker runtime test](../../../test/milestone-8-worker-runtime.test.mjs) | pending T-057 |
| AC-085 | [Quality gate](../../../test/milestone-8-quality-gate.test.mjs) | pending T-054 |
| AC-086 | [Compliance contract](../../../test/milestone-8-compliance-contract.test.mjs) | pending T-053 |
| AC-087 | [Compliance contract](../../../test/milestone-8-compliance-contract.test.mjs) | pending T-059 |
| AC-088 | [Offline infrastructure test](../../../test/milestone-8-offline-infra.test.mjs) | proven by T-060 |

The gate is not complete while any pending runtime criterion lacks its real
implementation and passing test.
