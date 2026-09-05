# Tasks: Project planning memory

> feature: project-planning-memory

<!--
  How to read this file (its format is verified by `onp-spec audit`):
  - T-xxx = task (a traceability code, unique across the entire project).
  - Every task references at least one user story (US-xxx) or acceptance
    criterion (AC-xxx) in `Refs:`.
  - Every task lists the files it creates or changes in `Arquivos:` — take care:
    this determines what `onp-spec plano` runs in PARALLEL (disjoint files)
    and what it runs sequentially.
  - Optional per-task fields, used by the execution plan:
    `- Modelo: claude-sonnet-5` and `- Esforço: alto` (baixo|medio|alto|xalto|max).
  - A task may become [concluida] only when its acceptance criteria have PASS
    evidence recorded by `onp-spec verify`.
  Status: pendente | em-andamento | concluida
    (shortcut: `onp-spec tarefa <feature> <T-xxx> <status>`)
-->

## T-001 — Create and validate the project's written memory [concluida]

- Refs: US-001, US-002, AC-001, AC-002, AC-003, AC-004, AC-005, AC-006
- Arquivos: docs/prds/README.md, docs/prds/00-contexto-e-escopo.md, docs/prds/01-arquitetura-e-dominio.md, docs/prds/02-graphql-federation.md, docs/prds/03-identidade-e-oauth.md, docs/prds/04-commerce-saga-e-realtime.md, docs/prds/05-apollo-mcp.md, docs/prds/06-plataforma-qualidade-e-entrega.md, docs/prds/07-roadmap.md, docs/prds/08-riscos-e-decisoes-pendentes.md, docs/prds/fontes.md, docs/knowledge/Mapa do Projeto.md, docs/knowledge/GraphQL Federation.md, docs/knowledge/Notas da Entrevista.md, test/project-planning-memory.test.mjs, graphify-out/graph.json, graphify-out/graph.html
- Notas: The task documents the plan; it does not implement the marketplace. The optional Obsidian canvas was not retained; graph JSON and HTML are the maintained graph artifacts.

## T-002 — Pin model and effort policy [concluida]

- Refs: US-003, AC-007
- Arquivos: AGENTS.md, onpspec.config.json, .spec/features/project-planning-memory/spec.md, .spec/features/project-planning-memory/tasks.md, test/project-planning-memory.test.mjs
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Notas: Mechanical policy/configuration change; it does not require a frontier model.
