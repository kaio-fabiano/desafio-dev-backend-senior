# Spec: B2B marketplace planning memory

> feature: project-planning-memory
> status: auditada

<!--
  How to read this file (its format is verified by `onp-spec audit`):
  - US-xxx = user story · AC-xxx = acceptance criterion
    ASM-xxx = assumption · Q-xxx = open question
    These are traceability codes: they link the specification to tasks and tests.
  - Every user story requires at least one acceptance criterion.
  - Every acceptance criterion requires complete Dado/Quando/Então steps.
  - Codes are unique across the entire project (never reuse a number).
  - Suposições and Perguntas em aberto are REQUIRED: if there are none,
    write "Nenhuma." — but be suspicious: nearly every feature hides one.
-->

## Context

The README consolidates the functional requirements, technical constraints, and
evaluation criteria for a distributed system. Before implementation, this
information must become navigable, traceable, and verifiable written memory so
that important decisions are not lost between sessions.

## Stories

<!-- User story: who needs it, what they need, and why. -->

### US-001 — Persistent, navigable planning

As the implementation owner, I want to consult PRDs linked by capability so
that each challenge stage has explicit context, boundaries, and definition of
done.

<!-- Acceptance criterion: the observable result that a test can check.
     Write for PEOPLE: the title and Então describe what the user sees
     ("the screen shows X"), not the technical detail ("endpoint returns 403") —
     details may appear in parentheses. -->

#### AC-001 — Index traces the original challenge

- **Dado** the challenge README
- **Quando** the planning memory is consulted
- **Então** an index points to requirements, deliverables, risks, and PRDs

#### AC-002 — Capabilities are separated into PRDs

- **Dado** the set of mandatory capabilities
- **Quando** the PRD folder is inspected
- **Então** architecture, federation, identity, commerce, MCP, platform, and roadmap have their own documents

### US-002 — Technical knowledge with supporting evidence

As a developer, I want technical decisions linked to official sources and
explicit risks so that implementation does not rely on memory or hidden
assumptions.

#### AC-003 — Federation has an operational guide

- **Dado** that GraphQL Federation is the highest-priority area
- **Quando** the federation guide is read
- **Então** it covers schema-first, entities, composition, Relay Connections, and a DataLoader per request

#### AC-004 — Incompatibilities and pending decisions are visible

- **Dado** that part of the architecture still depends on proof of concepts
- **Quando** the risk register is consulted
- **Então** SSE transport, OAuth audiences, WordPress integration, and deadline appear without false certainty

#### AC-005 — Sources include origin and consultation date

- **Dado** that libraries and documentation change
- **Quando** a technical recommendation is audited
- **Então** the official sources used are listed with their consultation dates

#### AC-006 — Memory can be navigated in Obsidian

- **Dado** the set of PRDs and technical notes
- **Quando** the knowledge base is opened as Markdown or in Obsidian
- **Então** notes with wikilinks and a graph exported by Graphify are available

### US-003 — Explicit execution cost

As the project owner, I want every task to receive a model and effort
recommendation before execution so that costs are controlled without reducing
rigor in critical areas.

#### AC-007 — Plan declares model and effort before execution

- **Dado** that a feature has implementation tasks
- **Quando** its execution plan is prepared
- **Então** every task receives recommended model and effort, project defaults are explicit, and execution awaits user confirmation

## Out of scope

- Implementing services, schemas, databases, queues, Docker, or infrastructure.
- Resolving decisions owned by the product owner without confirmation.
- Treating recommendations in this memory as substitutes for versions pinned in the lockfile.

## Suposições

<!-- What we are ASSUMING without confirmation. Status: aberta | confirmada | invalidada -->

| ID | Assumption | Status | Resolution |
|---|---|---|---|
| ASM-001 | The memory must be versioned in the repository itself. | confirmada | Explicit request to create written memory in PRDs. |
| ASM-002 | Markdown documents with wikilinks are suitable for use in Obsidian. | confirmada | The user authorized creating an Obsidian graph/nodes when useful. |

## Perguntas em aberto

<!-- What we do not know yet. Status: aberta | respondida -->

Nenhuma regarding the delivery of this memory. Product and architecture
decisions that implementation still needs to resolve are recorded in
`docs/prds/08-riscos-e-decisoes-pendentes.md`.
