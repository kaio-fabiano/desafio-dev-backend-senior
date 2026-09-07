# Constitution — v1.1.0

<!--
  Non-negotiable project principles. They are constraints, not style.
  P-xxx = principle (traceability code, like US/AC/T).
  Levels: [DEVE] mandatory · [RECOMENDADO] strong recommendation · [PODE] permitted/explicit.
  Every [DEVE] requires executable verification — otherwise the audit reports
  "principle without verification" (PRINCIPIO_SEM_VERIFICACAO). Formats:
    - verificação(gate): satisfied by the audit itself (only for "meta" principles)
    - verificação(teste): @principle:P-xxx
    - verificação(proibido): `regex` in `glob`
    - verificação(obrigatório): `regex` in `glob`
-->

## P-001 [DEVE] Every requirement has executable evidence

No feature is declared ready until the audit in CI mode succeeds (exit 0).
This principle is verified by the audit mechanism itself (AC_SEM_TESTE,
AC_SEM_PROVA, TASK_CONCLUIDA_SEM_PROVA) — it requires no additional test.

- verificação(gate): intrinsic to the audit

## P-002 [RECOMENDADO] Secrets never appear in code

Keys and passwords come from environment variables, never hard-coded.

- verificação(proibido): `(api[_-]?key|senha|password)\s*[:=]\s*['"][^'"]{8,}` em `apps/**/src/**/*.ts`

## P-003 [DEVE] Production behavior is developed through TDD

Every implementation task records an expected Red failure before production
changes, reaches Green with the minimum implementation, and completes Refactor
with the relevant test, coverage, typecheck, lint, verification, and audit gates
green. Structural source inspection complements but never replaces behavioral
unit, integration, contract, or end-to-end tests.

- verificação(teste): @principle:P-003

## P-004 [DEVE] Strict DDD decisions are explicit before implementation

Every production change identifies its bounded context, use case, aggregate
or explicit absence of one, invariants, consistency boundary, and affected
ports. The canonical rules are maintained in
`docs/standards/strict-nestjs-ddd.md` and must not be silently bypassed.

- verificação(teste): @spec:AC-253

## P-005 [DEVE] The strict DDD contract is the repository authority

Strategic design, bounded-context ownership, aggregate boundaries, dependency
direction, class and file rules, naming, allowed exceptions, and required test
layers are defined in the canonical strict DDD standard and referenced by the
agent instructions and architecture documentation.

- verificação(teste): @spec:AC-252
