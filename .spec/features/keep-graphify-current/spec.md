# Spec: Keep Graphify current

> feature: keep-graphify-current
> status: rascunho

## Context

The repository already publishes a Graphify knowledge graph, but generated caches and portable outputs are mixed together and no shared gate detects a stale graph. Contributors need a current graph immediately after cloning without committing machine-specific state.

## User stories

### US-061 — Portable and current repository graph

As a contributor, I want the canonical Graphify outputs to match the committed source, so that architecture queries work immediately after cloning the repository.

#### AC-129 — Canonical outputs are versioned and freshness is enforced

- **Dado** the repository source and its Graphify knowledge graph
- **Quando** a contributor changes graph-relevant files or opens a pull request
- **Então** portable graph outputs are versioned, machine-local caches are ignored, and CI rejects a stale canonical graph

## Out of scope

- Committing AST or semantic caches, interpreter paths, query history, or temporary analysis files.
- Running semantic document extraction on every commit.
- Adding a new graph-generation dependency.

## Suposições

| ID | Assumption | Status | Resolution |
|---|---|---|---|
| ASM-047 | The canonical shared outputs are `graph.json`, `manifest.json`, `GRAPH_REPORT.md`, and `graph.html`. | confirmada | Confirmed by the user on 2026-09-01. |

## Perguntas em aberto

None.
