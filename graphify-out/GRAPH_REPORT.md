# Graph Report - desafio-dev-backend-senior  (2026-08-25)

## Corpus Check
- Corpus is ~46,394 words - fits in a single context window. You may not need a graph.

## Summary
- 362 nodes · 707 edges · 15 communities (14 shown, 1 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.89)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Planejamento e Arquitetura
- Orquestração CLI
- Motor de Auditoria
- Registro de Lições
- Requisitos do Desafio
- Fluxo Spec Driven
- Planejador de Execução
- Comandos e Relatórios
- Configuração TypeScript Base
- Dependências do Workspace
- Configuração Nx
- Gerador de Testes
- Projeto TypeScript
- Template LGPD Educação

## God Nodes (most connected - your core abstractions)
1. `run()` - 25 edges
2. `compilerOptions` - 18 edges
3. `Índice dos PRDs do marketplace` - 12 edges
4. `cmdLicoes()` - 11 edges
5. `gerarArtefatosPlano()` - 10 edges
6. `cmdResumo()` - 10 edges
7. `adicionarLicao()` - 10 edges
8. `loadProject()` - 10 edges
9. `scaffoldTests()` - 10 edges
10. `montarPlano()` - 9 edges

## Surprising Connections (you probably didn't know these)
- `Integração do gate com CI` --semantically_similar_to--> `Pipeline CI`  [INFERRED] [semantically similar]
  .agents/skills/onp-spec-driven/references/fluxo.md → .github/workflows/ci.yml
- `Template de constituição base` --semantically_similar_to--> `Constituição vigente do projeto`  [INFERRED] [semantically similar]
  .agents/skills/onp-spec-driven/scripts/lib/templates/constituicao-base.md → .spec/constituicao.md
- `Todo requisito tem prova executável` --semantically_similar_to--> `P-001 Todo requisito tem prova executável`  [INFERRED] [semantically similar]
  .agents/skills/onp-spec-driven/scripts/lib/templates/constituicao-base.md → .spec/constituicao.md
- `Segredos nunca em código` --semantically_similar_to--> `P-002 Segredos nunca em código`  [INFERRED] [semantically similar]
  .agents/skills/onp-spec-driven/scripts/lib/templates/constituicao-base.md → .spec/constituicao.md
- `Gate onp-spec audit --ci` --conceptually_related_to--> `Pipeline CI`  [INFERRED]
  .agents/skills/onp-spec-driven/SKILL.md → .github/workflows/ci.yml

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Fluxo de rastreabilidade da especificação à prova** — agents_skills_onp_spec_driven_skill_traceability_chain, agents_skills_onp_spec_driven_references_escrevendo_specs_auditable_acceptance_criteria, agents_skills_onp_spec_driven_scripts_lib_templates_tasks_feature_tasks_template, agents_skills_onp_spec_driven_references_fluxo_runner_evidence [EXTRACTED 1.00]
- **Composição do supergraph federado** — readme_graphql_gateway, readme_users_subgraph, readme_orders_subgraph, readme_woocommerce_catalog, readme_schema_first [EXTRACTED 1.00]
- **Fluxo assíncrono do checkout à atualização por SSE** — readme_orders_subgraph, readme_rabbitmq, readme_payment_processor, readme_choreographed_saga, readme_graphql_sse, readme_idempotency_key [EXTRACTED 1.00]
- **Navegação da memória física do projeto** — docs_knowledge_mapa_do_projeto_project_map, docs_prds_readme_prd_index, spec_features_project_planning_memory_spec_project_planning_memory [EXTRACTED 1.00]
- **Execução federada da query me** — docs_prds_02_graphql_federation_federation_prd, docs_prds_03_identidade_e_oauth_identity_prd, docs_prds_04_commerce_saga_e_realtime_commerce_saga_prd, docs_prds_02_graphql_federation_request_scoped_dataloader [EXTRACTED 1.00]
- **Entrega orientada às PoCs de maior risco** — docs_prds_07_roadmap_critical_compatibility_pocs, docs_prds_08_riscos_e_decisoes_pendentes_sse_protocol_incompatibility, docs_prds_08_riscos_e_decisoes_pendentes_audience_same_token_risk, docs_prds_08_riscos_e_decisoes_pendentes_order_authority_risk [EXTRACTED 1.00]

## Communities (15 total, 1 thin omitted)

### Community 0 - "Planejamento e Arquitetura"
Cohesion: 0.06
Nodes (50): Apollo MCP, Paridade de identidade GraphQL e MCP, Caminho federado da query me, GraphQL Federation, Supergraph como contrato composto de SDLs, Identidade OAuth2, Validação OAuth2 por resource server, Mapa do Projeto (+42 more)

### Community 1 - "Orquestração CLI"
Cohesion: 0.10
Nodes (43): cmdEvento(), cmdInit(), cmdResumo(), cmdStreamResumo(), copyDirIfExists(), detectarAgente(), __dirname, resolveSkillDir() (+35 more)

### Community 2 - "Motor de Auditoria"
Cohesion: 0.12
Nodes (30): auditProject(), CI_ESCALATES, finding(), latestMtime(), loadProject(), grepPattern(), scanAnnotations(), staticDirOf() (+22 more)

### Community 3 - "Registro de Lições"
Cohesion: 0.14
Nodes (32): cmdLicoes(), linhaLicao(), DEFAULT_CONFIG, adicionarLicao(), agora(), caminhoRender(), caminhoStore(), campo() (+24 more)

### Community 4 - "Requisitos do Desafio"
Cohesion: 0.09
Nodes (34): Template de constituição base, Segredos nunca em código, Todo requisito tem prova executável, Apollo Federation v2, Apollo MCP Server autenticado, Better Auth OAuth Provider, Saga coreografada de pagamento e estoque, DataLoader por requisição (+26 more)

### Community 5 - "Fluxo Spec Driven"
Cohesion: 0.07
Nodes (31): Verificação executável de princípios, Preset LGPD + Educação, Níveis DEVE, RECOMENDADO e PODE, Constituição do projeto, Suposições e perguntas em aberto, Critérios de aceite observáveis e auditáveis, Dado / Quando / Então, Códigos globais de rastreio (+23 more)

### Community 6 - "Planejador de Execução"
Cohesion: 0.13
Nodes (30): cmdPlano(), cmdTarefa(), definirCampoTarefa(), gerarArtefatosPlano(), AGENTES, allowedTools(), descreveTarefa(), ehModeloClaude() (+22 more)

### Community 7 - "Comandos e Relatórios"
Cohesion: 0.13
Nodes (21): cmdAssumptions(), cmdNew(), cmdStatus(), fill(), parseFlags(), run(), loadConfig(), FINDING_LABELS (+13 more)

### Community 8 - "Configuração TypeScript Base"
Cohesion: 0.10
Nodes (20): @desafio-dev-backend-senior/source, es2022, compilerOptions, composite, customConditions, declarationMap, emitDeclarationOnly, importHelpers (+12 more)

### Community 9 - "Dependências do Workspace"
Cohesion: 0.10
Nodes (19): @nx/js, dependencies, devDependencies, nx, @nx/js, prettier, @swc/helpers, tslib (+11 more)

### Community 10 - "Configuração Nx"
Cohesion: 0.17
Nodes (11): analytics, namedInputs, default, production, sharedGlobals, plugins, $schema, default (+3 more)

### Community 11 - "Gerador de Testes"
Cohesion: 0.44
Nodes (8): detectStyle(), jsFail(), jsHeader(), renderJsPrinciple(), renderJsTest(), renderPyPrinciple(), renderPyTest(), scaffoldTests()

### Community 12 - "Projeto TypeScript"
Cohesion: 0.33
Nodes (5): ./tsconfig.base.json, compileOnSave, extends, files, references

## Knowledge Gaps
- **78 isolated node(s):** `__dirname`, `TEMPLATES_DIR`, `SKILL_DIR_POR_AGENTE`, `SKILLS_DIR_PROJETO`, `CI_ESCALATES` (+73 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Monorepo Nx` connect `Fluxo Spec Driven` to `Requisitos do Desafio`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Why does `Marketplace B2B federado com MCP e saga de pagamentos` connect `Requisitos do Desafio` to `Fluxo Spec Driven`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `__dirname`, `TEMPLATES_DIR`, `SKILL_DIR_POR_AGENTE` to the rest of the system?**
  _78 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Planejamento e Arquitetura` be split into smaller, more focused modules?**
  _Cohesion score 0.05551020408163265 - nodes in this community are weakly interconnected._
- **Should `Orquestração CLI` be split into smaller, more focused modules?**
  _Cohesion score 0.10083256244218317 - nodes in this community are weakly interconnected._
- **Should `Motor de Auditoria` be split into smaller, more focused modules?**
  _Cohesion score 0.11711711711711711 - nodes in this community are weakly interconnected._
- **Should `Registro de Lições` be split into smaller, more focused modules?**
  _Cohesion score 0.1380952380952381 - nodes in this community are weakly interconnected._