# Spec: Production readiness gap register

> feature: production-readiness-gap-register
> status: pronta

## Contexto

The challenge implementation has executable delivery evidence, but the remaining
steps toward a real production platform are scattered across roadmap, risk, and
runbook documents. Maintainers need one prioritized register that distinguishes
delivered scope from future production work.

## Histórias

### US-078 — Preserve the production-readiness backlog

As a maintainer, I want every known production gap recorded with an executable
completion boundary, so that subsequent work is prioritized and no limitation is
mistaken for a delivered capability.

#### AC-159 — Every known gap has an actionable closure contract

- **Dado** the current payment, WordPress, messaging, infrastructure, observability, security, quality, and recovery limitations
- **Quando** maintainers inspect the roadmap and risk register
- **Então** every gap has priority, current evidence, target state, dependencies, acceptance evidence, and an explicit ADR trigger

### US-094 — Resume production work without reconstructing context

As a maintainer, I want a concise next-session handoff anchored to the canonical
gap register, so that work resumes in priority order without duplicating or
silently changing production scope.

#### AC-187 — The next session has an explicit and honest starting point

- **Dado** that challenge delivery is complete and production gaps remain open
- **Quando** a maintainer opens the next-session handoff
- **Então** it identifies the merged baseline, orders G-001 through G-003, states their external dependencies, and links back to the authoritative register and runbooks

## Fora de escopo

- Implementing any production-readiness gap.
- Selecting a payment provider or cloud account.
- Changing the runtime topology.
- Implementing any item described by the next-session handoff.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-057 | The listed gaps are the currently known production gaps, not a permanent exhaustive security certification. | confirmada | The register requires continuous review and can accept newly discovered gaps. |

## Perguntas em aberto

| ID | Pergunta | Status | Resposta |
|---|---|---|---|
| Q-007 | Which real payment provider and target cloud account will be used? | respondida | Neither is selected yet. The register is complete without that choice; G-001 and G-002 explicitly remain blocked on separate owner-approved selections. |
