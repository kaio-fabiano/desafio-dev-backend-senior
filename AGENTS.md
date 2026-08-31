# Project Agent Instructions

## Spec-Driven Execution

- Every implementation task must declare `Modelo:` and `Esforço:` in
  `tasks.md` before the plan is generated. These parser keywords must remain
  unchanged in onp-spec task files.
- Recommend `gpt-5.6-luna` + low effort for documentation and mechanical
  changes; `gpt-5.6-terra` + medium effort for ordinary implementation; and
  `gpt-5.6-sol` + high effort for distributed architecture, authentication,
  payments, concurrency, or critical debugging.
- Use `xalto` effort only when a critical task remains ambiguous after
  investigation. Never increase the model or effort silently.
- Before execution, present the task → model → effort table and wait for the
  user's explicit confirmation, together with the parallelism choice.
- The approved model and effort must be fixed in the generated plan; complete
  the task only after `onp-spec verify` and `onp-spec audit --ci` pass.

## Project Language

- All project-authored code, identifiers, documentation, branch names, and
  commit messages must be written in English.
- Only user-visible frontend copy may be written in Portuguese.
