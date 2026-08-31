# Milestone 8 evidence matrix

This matrix records the evidence accepted by the compliance gate. The complete
protocol-level journey passed on 2026-08-31; focused contracts remain linked so
each criterion is independently discoverable.

| Criterion | Required evidence                                                                            | Status |
| --------- | -------------------------------------------------------------------------------------------- | ------ |
| AC-078    | [Real E2E test](../../../test/milestone-8-real-e2e.test.mjs)                                 | proven |
| AC-079    | [Real E2E test](../../../test/milestone-8-real-e2e.test.mjs)                                 | proven |
| AC-080    | [Identity runtime test](../../../test/milestone-8-identity-gateway.test.mjs)                 | proven |
| AC-081    | [Identity runtime test](../../../test/milestone-8-identity-gateway.test.mjs)                 | proven |
| AC-082    | [Identity runtime test](../../../test/milestone-8-identity-gateway.test.mjs)                 | proven |
| AC-083    | [Commerce runtime test](../../../test/milestone-8-commerce-runtime.test.mjs)                 | proven |
| AC-084    | [Payment and inventory runtime test](../../../test/delivery-closure-inventory-saga.test.mjs) | proven |
| AC-085    | [Quality gate](../../../test/milestone-8-quality-gate.test.mjs)                              | proven |
| AC-086    | [Compliance contract](../../../test/milestone-8-compliance-contract.test.mjs)                | proven |
| AC-087    | [Compliance contract](../../../test/milestone-8-compliance-contract.test.mjs)                | proven |
| AC-088    | [Offline infrastructure test](../../../test/milestone-8-offline-infra.test.mjs)              | proven |

No separate Stock worker is required: the inventory consumer is an internal
boundary of the Java Payment Federation and reaches WooCommerce through the
federated WordPress GraphQL contract.
