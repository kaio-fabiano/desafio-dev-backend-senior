# Spec: Stable import ordering

> feature: import-order-stability
> status: auditada

## Context

Opening or saving TypeScript files in VS Code must not create unrelated import-order changes. Import organization remains an explicit developer action.

## User stories

### US-045 — Keep source files stable while editing

As a maintainer, I want VS Code to preserve import ordering during automatic save actions, so that unrelated files do not become modified while I browse or edit the repository.

#### AC-089 — Automatic save actions preserve import order

- **Dado** the versioned VS Code workspace settings
- **Quando** VS Code runs configured save actions for a JavaScript or TypeScript file
- **Então** source import organization is disabled unless the developer invokes it explicitly

## Out of scope

- Enforcing a new repository-wide import ordering convention.
- Rewriting existing imports.

## Suposições

None.

## Perguntas em aberto

None.
