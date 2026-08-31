# Spec: Stabilize TypeScript projects and editor behavior

> feature: stabilize-typescript-editor
> status: auditada

## Contexto

TypeScript applications are not included in explicit TypeScript projects or Nx typecheck targets. VS Code therefore reports inferred-project diagnostics, while language-specific user settings can still override the workspace-level import-order protection.

## Histórias

### US-054 — Keep TypeScript feedback deterministic

As a maintainer, I want application diagnostics and import ordering to match repository gates so that opening or saving a file does not mutate it or expose errors hidden by CI.

#### AC-107 — Every TypeScript application is typechecked

- **Dado** the active TypeScript application projects
- **Quando** the Nx typecheck gate runs
- **Então** each application is backed by an explicit TypeScript configuration and its diagnostics pass

#### AC-108 — VS Code never organizes TypeScript imports automatically

- **Dado** workspace and language-specific editor settings
- **Quando** a TypeScript or TypeScript React file is opened or saved
- **Então** organize-imports code actions remain disabled without changing manual import order

## Fora de escopo

- Changing the repository's manual import-order convention.
- Overriding explicit user invocation of the Organize Imports command.
- Adding an import-sorting dependency.

## Suposições

| ID | Suposição | Status | Resolução |
|---|---|---|---|
| ASM-037 | The reported diagnostics are caused by inferred TypeScript projects because the existing Nx library typechecks pass. | confirmada | Active application projects have no `tsconfig` or `typecheck` target, and the Nx gate currently checks only libraries and infrastructure. |

## Perguntas em aberto

Nenhuma.
