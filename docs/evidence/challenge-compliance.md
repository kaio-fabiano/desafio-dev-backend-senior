# Challenge compliance evidence

This is the compliance gate for the immutable challenge contract. The
challenge README is the source of truth; repository specifications and task
lists are not evidence of compliance. A row is only `proven` when its evidence
link points to an executable test or gate. The complete Testcontainers journey
was last executed successfully on 2026-09-02; structural contracts keep the
same assertions discoverable by the specification audit.

Source: [challenge README](../../README.md).

| Requirement                                                | Challenge source                                                                 | Status   | Executable evidence                                                          |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------- |
| O1 — Apollo Federation v2 schema-first                     | [§2 Objectives](../../README.md#2-objetivos)                                     | proven   | [real E2E contract](../../test/milestone-8-real-e2e.test.mjs)                |
| O2 — WordPress and WooCommerce authority                   | [§1 Overview](../../README.md#1-visão-geral-do-desafio)                          | proven   | [real E2E contract](../../test/milestone-8-real-e2e.test.mjs)                |
| O3 — Better Auth OAuth2 authorization server               | [§2 Objectives](../../README.md#2-objetivos)                                     | proven   | [real E2E contract](../../test/milestone-8-real-e2e.test.mjs)                |
| O4 — Federated identity and linked buyer                   | [§5 Minimum capabilities](../../README.md#5-capacidades-mínimas-do-sistema)      | proven   | [real E2E contract](../../test/milestone-8-real-e2e.test.mjs)                |
| O5 — Apollo MCP over the supergraph                        | [§2 Objectives](../../README.md#2-objetivos)                                     | proven   | [real E2E contract](../../test/milestone-8-real-e2e.test.mjs)                |
| O6 — Client-generated idempotent checkout                  | [§2 Objectives](../../README.md#2-objetivos)                                     | proven   | [complete buyer contract](../../test/milestone-7-e2e-contract.test.mjs)      |
| O7 — RabbitMQ choreographed saga with compensation         | [§2 Objectives](../../README.md#2-objetivos)                                     | proven   | [complete buyer contract](../../test/milestone-7-e2e-contract.test.mjs)      |
| O8 — GraphQL subscriptions over SSE                        | [§2 Objectives](../../README.md#2-objetivos)                                     | proven   | [complete buyer contract](../../test/milestone-7-e2e-contract.test.mjs)      |
| O9 — Authenticated Apollo MCP                              | [§2 Objectives](../../README.md#2-objetivos)                                     | proven   | [real E2E contract](../../test/milestone-8-real-e2e.test.mjs)                |
| RF01–RF08 — identity, catalog, cart, orders and federation | [§16 Functional requirements](../../README.md#16-requisitos-funcionais)          | proven   | [real E2E contract](../../test/milestone-8-real-e2e.test.mjs)                |
| RF09 — Idempotent checkout under frontend retry            | [§16 Functional requirements](../../README.md#16-requisitos-funcionais)          | proven   | [complete buyer contract](../../test/milestone-7-e2e-contract.test.mjs)      |
| RF10 — Card and Pix payment outcomes                       | [§16 Functional requirements](../../README.md#16-requisitos-funcionais)          | proven   | [complete buyer contract](../../test/milestone-7-e2e-contract.test.mjs)      |
| RF11 — SSE subscriptions                                   | [§16 Functional requirements](../../README.md#16-requisitos-funcionais)          | proven   | [complete buyer contract](../../test/milestone-7-e2e-contract.test.mjs)      |
| RF12 — Inventory reservation and payment compensation      | [§16 Functional requirements](../../README.md#16-requisitos-funcionais)          | proven   | [complete buyer contract](../../test/milestone-7-e2e-contract.test.mjs)      |
| RF13–RF15 — orders, curated MCP tools and authorization    | [§16 Functional requirements](../../README.md#16-requisitos-funcionais)          | proven   | [real E2E contract](../../test/milestone-8-real-e2e.test.mjs)                |
| RNF01–RNF06 — non-functional requirements                  | [§17 Non-functional requirements](../../README.md#17-requisitos-não-funcionais)  | proven   | [quality gate](../../test/milestone-8-quality-gate.test.mjs)                 |
| Acceptance — GraphQL, saga, MCP and deployment assertions  | [§18 Acceptance criteria](../../README.md#18-critérios-de-aceitação-e-avaliação) | proven   | [complete buyer contract](../../test/milestone-7-e2e-contract.test.mjs)      |
| Observability bonus (optional)                             | [§13 Observability](../../README.md#13-observabilidade-opcional-desejável)       | optional | [observability contract](../../test/delivery-closure-observability.test.mjs) |

The matrix deliberately does not claim that a future task is evidence. No row
contains a task reference; task status belongs to the delivery plan, while
this record remains anchored to the challenge and executable artifacts.

The successful local acceptance run proves the challenge contract against the
isolated Testcontainers topology. It is not evidence of a deployed production
environment or a credentialed Mercado Pago sandbox transaction; those remain
explicitly tracked in the [production-readiness gap register](../prds/08-riscos-e-decisoes-pendentes.md#production-readiness-gap-register).
