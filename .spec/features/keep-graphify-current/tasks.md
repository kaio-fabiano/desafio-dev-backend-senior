# Tasks: Keep Graphify current

> feature: keep-graphify-current

## T-100 — Version and verify canonical Graphify outputs [concluida]
- Refs: US-061, AC-129
- Arquivos: .gitignore, package.json, .github/workflows/ci.yml, scripts/check-graphify-current.mjs, graphify-out/graph.json, graphify-out/manifest.json, graphify-out/GRAPH_REPORT.md, graphify-out/graph.html, test/keep-graphify-current.test.mjs
- Modelo: gpt-5.6-terra
- Esforço: medio
- Notes: Reuse Graphify and Node.js; do not commit machine-specific caches or add dependencies.
