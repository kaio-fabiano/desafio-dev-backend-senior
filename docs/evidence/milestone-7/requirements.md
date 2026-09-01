# Milestone 7 requirement evidence matrix

This matrix is the delivery contract for the mandatory Milestone 7 gate. Each
criterion has a runnable proof or a reviewable operational artifact. The
OpenTelemetry work described by the challenge is optional and is intentionally
not a release gate.

| Criterion | Mandatory requirement                                                                             | Evidence                                                                                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-067    | One isolated command starts the complete environment, runs the journey, and tears it down.        | [E2E acceptance target](../../../apps/e2e/src/milestone-7.e2e.test.ts), [E2E contract](../../../test/milestone-7-e2e-contract.test.mjs), [E2E runbook](../../runbooks/e2e.md) |
| AC-068    | Registration links the buyer identity and accepts the scoped token at Gateway and MCP.            | [E2E journey](../../../apps/e2e/src/journey.ts), [E2E contract](../../../test/milestone-7-e2e-contract.test.mjs)                                                              |
| AC-069    | Card checkout is idempotent and converges to one approved order and charge across projections.    | [E2E journey](../../../apps/e2e/src/journey.ts), [E2E contract](../../../test/milestone-7-e2e-contract.test.mjs)                                                              |
| AC-070    | Pix checkout exposes one stable generated Pix code across projections.                            | [E2E journey](../../../apps/e2e/src/journey.ts), [E2E contract](../../../test/milestone-7-e2e-contract.test.mjs)                                                              |
| AC-071    | MCP parity is exact and missing, wrong-audience, and under-scoped requests are rejected.          | [E2E journey](../../../apps/e2e/src/journey.ts), [MCP evidence index](../../evidence/mcp/README.md), [E2E contract](../../../test/milestone-7-e2e-contract.test.mjs)          |
| AC-072    | Order and payment line coverage remains at or above 70 percent.                                   | [Coverage contract](../../../test/milestone-7-coverage.test.mjs), [Quality evidence](quality.md)                                                                              |
| AC-073    | Warm Gateway P95 remains below 500 ms and entity loads are batched.                               | [Load contract](../../../test/milestone-7-load.test.mjs), [Quality evidence](quality.md)                                                                                      |
| AC-074    | Nx provides one cached cross-language graph for Node and Java targets.                            | [Nx quality contract](../../../test/milestone-7-nx-quality.test.mjs)                                                                                                          |
| AC-075    | Application images are pinned, multi-stage, non-root where supported, and healthchecked.          | [Container contract](../../../test/milestone-7-containers.test.mjs), [Local development runbook](../../runbooks/local-development.md)                                         |
| AC-076    | Pinned SST v3 validation and diff are reproducible; deployment remains credentialed and approved. | [SST contract](../../../test/milestone-7-sst.test.mjs), [Deployment runbook](../../runbooks/deployment.md)                                                                    |
| AC-077    | Every mandatory requirement is linked to executable or reviewable evidence.                       | This matrix and [Milestone 7 evidence index](README.md)                                                                                                                       |

## Release policy

AC-067 through AC-077 are mandatory. A green focused test, followed by the
repository verification and audit gates, is required before release. OpenTelemetry
is an optional bonus and must not be used to waive or replace any row above.
