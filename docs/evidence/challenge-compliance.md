# Challenge compliance evidence

This is the compliance gate for the immutable challenge contract. The
challenge README is the source of truth; repository specifications and task
lists are not evidence of compliance. A row is only `proven` when its evidence
link points to an executable test or gate. The complete Testcontainers journey
was last executed successfully on 2026-09-02; structural contracts keep the
same assertions discoverable by the specification audit.

Source: [challenge README](../../README.md).

| Requirement                                                | Challenge source                                                                 | Status   | Executable evidence                                                              |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------- |
| O1 — Apollo Federation v2 schema-first                     | [§2 Objectives](../../README.md#2-objetivos)                                     | proven   | [real E2E topology](../../test/milestone-8-real-e2e.test.mjs)                    |
| O2 — Supplier-owned WooCommerce products                   | [§2 Objectives](../../README.md#2-objetivos)                                     | proven   | [ownership E2E](../../apps/e2e/src/milestone-7.e2e.test.ts)                      |
| O3 — Better Auth OAuth2 authorization server               | [§2 Objectives](../../README.md#2-objetivos)                                     | proven   | [identity OAuth contract](../../test/milestone-8-identity-gateway.test.mjs)      |
| O4 — NestJS Better Auth at Gateway and Identity            | [§2 Objectives](../../README.md#2-objetivos)                                     | proven   | [NestJS identity contract](../../test/identity-federation-refactor.test.mjs)     |
| O5 — Federated users, user, me, orders and products        | [§2 Objectives](../../README.md#2-objetivos)                                     | proven   | [complete E2E journey](../../apps/e2e/src/milestone-7.e2e.test.ts)               |
| O6 — Client-generated idempotent checkout                  | [§2 Objectives](../../README.md#2-objetivos)                                     | proven   | [complete E2E journey](../../apps/e2e/src/milestone-7.e2e.test.ts)               |
| O7 — RabbitMQ choreographed saga with compensation         | [§2 Objectives](../../README.md#2-objetivos)                                     | proven   | [complete E2E journey](../../apps/e2e/src/milestone-7.e2e.test.ts)               |
| O8 — GraphQL subscriptions over SSE                        | [§2 Objectives](../../README.md#2-objetivos)                                     | proven   | [complete E2E journey](../../apps/e2e/src/milestone-7.e2e.test.ts)               |
| O9 — OAuth2-authenticated Apollo MCP                       | [§2 Objectives](../../README.md#2-objetivos)                                     | proven   | [authenticated MCP E2E](../../apps/e2e/src/milestone-7.e2e.test.ts)              |
| O10 — Separate Java payment runtime                        | [§2 Objectives](../../README.md#2-objetivos)                                     | proven   | [payment runtime contract](../../test/delivery-closure-payment-runtime.test.mjs) |
| O11 — Relay Connections and request-scoped batching        | [§2 Objectives](../../README.md#2-objetivos)                                     | proven   | [Relay and N+1 counter](../../test/graphql-relay-dataloader-closure.test.mjs)    |
| O12 — Automated greenfield E2E                             | [§2 Objectives](../../README.md#2-objetivos)                                     | proven   | [Testcontainers journey](../../apps/e2e/src/milestone-7.e2e.test.ts)             |
| RF01–RF08 — identity, catalog, cart, orders and federation | [§16 Functional requirements](../../README.md#16-requisitos-funcionais)          | proven   | [real E2E contract](../../test/milestone-8-real-e2e.test.mjs)                    |
| RF09 — Idempotent checkout under frontend retry            | [§16 Functional requirements](../../README.md#16-requisitos-funcionais)          | proven   | [complete buyer contract](../../test/milestone-7-e2e-contract.test.mjs)          |
| RF10 — Card and Pix payment outcomes                       | [§16 Functional requirements](../../README.md#16-requisitos-funcionais)          | proven   | [complete buyer contract](../../test/milestone-7-e2e-contract.test.mjs)          |
| RF11 — SSE subscriptions                                   | [§16 Functional requirements](../../README.md#16-requisitos-funcionais)          | proven   | [complete buyer contract](../../test/milestone-7-e2e-contract.test.mjs)          |
| RF12 — Inventory reservation and payment compensation      | [§16 Functional requirements](../../README.md#16-requisitos-funcionais)          | proven   | [complete buyer contract](../../test/milestone-7-e2e-contract.test.mjs)          |
| RF13–RF15 — orders, curated MCP tools and authorization    | [§16 Functional requirements](../../README.md#16-requisitos-funcionais)          | proven   | [real E2E contract](../../test/milestone-8-real-e2e.test.mjs)                    |
| RNF01–RNF06 — non-functional requirements                  | [§17 Non-functional requirements](../../README.md#17-requisitos-não-funcionais)  | proven   | [quality gate](../../test/milestone-8-quality-gate.test.mjs)                     |
| Acceptance — GraphQL, saga, MCP and deployment assertions  | [§18 Acceptance criteria](../../README.md#18-critérios-de-aceitação-e-avaliação) | proven   | [complete buyer contract](../../test/milestone-7-e2e-contract.test.mjs)          |
| Observability bonus (optional)                             | [§13 Observability](../../README.md#13-observabilidade-opcional-desejável)       | optional | [observability contract](../../test/delivery-closure-observability.test.mjs)     |

The matrix deliberately does not claim that a future task is evidence. No row
contains a task reference; task status belongs to the delivery plan, while
this record remains anchored to the challenge and executable artifacts.

The local acceptance run proves the challenge contract against the isolated
Testcontainers topology. The separate [sandbox release smoke test](mercado-pago-production-deployment/smoke-test.md)
proves the credentialed AWS deployment, authenticated GraphQL and MCP access,
and idempotent Mercado Pago Card, Pix, webhook, and refund behavior. Production
promotion remains protected and is not implied by sandbox evidence.
