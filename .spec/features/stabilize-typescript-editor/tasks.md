# Tasks: Stabilize TypeScript projects and editor behavior

> feature: stabilize-typescript-editor

## T-083 — Add explicit application typecheck projects [concluida]
- Refs: US-054, AC-107
- Modelo: gpt-5.6-terra
- Esforço: medio
- Arquivos: apps/gateway/project.json, apps/gateway/tsconfig.app.json, apps/identity-subgraph/project.json, apps/identity-subgraph/tsconfig.app.json, tsconfig.json, test/typescript-editor-stability.test.mjs
- Notas: Reuse the root compiler policy and existing library path aliases; add no compiler wrapper or dependency.

## T-084 — Lock language-specific import behavior [concluida]
- Refs: US-054, AC-108
- Modelo: gpt-5.6-luna
- Esforço: baixo
- Arquivos: .vscode/settings.json, test/typescript-editor-stability.test.mjs
- Notas: Disable organize-import actions in TypeScript language scopes so user-level language overrides cannot supersede the workspace intent.
