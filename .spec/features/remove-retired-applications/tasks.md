# Tasks: Remove retired applications

> feature: remove-retired-applications

## T-081 — Remove retired runtimes and executable dependencies [concluida]
- Refs: US-053, AC-104, AC-105
- Modelo: gpt-5.6-sol
- Esforço: alto
- Arquivos: apps/e2e/project.json, compose.yaml, infra/sst.config.ts, test/retired-applications-removal.test.mjs
- Notas: Delete retired source trees and tests that exist only to execute them; keep current five-application acceptance coverage.

## T-082 — Verify and document the reduced project graph [concluida]

- Refs: US-053, AC-104, AC-105, AC-106
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Arquivos: README.md, docs/knowledge/Mapa do Projeto.md, docs/runbooks, docs/prds, test/retired-applications-removal.test.mjs
- Notas: Update active documentation, add the architecture regression test, and run all required gates.
