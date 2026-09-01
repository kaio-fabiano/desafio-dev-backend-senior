# Plano de execução — remove-wordpress-federation-runtime

> gerado por `onp-spec plano` em 2026-08-31 23:08 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano remove-wordpress-federation-runtime --paralelizar T-002,T-003,T-004`

## Resumo — o que vai acontecer

- **4 tarefa(s) pendente(s)**: 3 em 3 faixa(s) paralela(s) + 1 sequencial(is)
- **seleção do usuário**: paralelizar só T-002, T-003, T-004 — as demais rodam uma após a outra, ao final
- **1 faixa = 1 worktree + 1 branch + 1 janela de contexto limpa** — faixas não compartilham nenhum arquivo entre si
- prefere outra seleção ou uma após a outra? Regenere com `onp-spec plano remove-wordpress-federation-runtime --paralelizar T-xxx,T-yyy` ou `--sequencial`
- tudo acontece na branch de trabalho `spec/remove-wordpress-federation-runtime`; levar para a main é decisão sua

## Faixas e ondas

### Onda 1 — faixa-1 ∥ faixa-2 ∥ faixa-3

#### faixa-1 — branch `spec/remove-wordpress-federation-runtime-faixa-1` — worktree `../onp-worktrees/desafio-dev-backend-senior-remove-wordpress-federation-runtime-faixa-1`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-002 | Route integrations directly to native WordPress | `gpt-5.6-sol` | high | `libs/gateway/nest/src/gateway.module.ts`, `libs/contracts/graphql/supergraph.yaml`, `compose.yaml`, `apps/wordpress-integration/compose.yaml`, `apps/wordpress-integration/scripts/install-plugins.sh`, `apps/e2e/src/environment.ts` |

#### faixa-2 — branch `spec/remove-wordpress-federation-runtime-faixa-2` — worktree `../onp-worktrees/desafio-dev-backend-senior-remove-wordpress-federation-runtime-faixa-2`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-003 | Remove the redundant WordPress NestJS runtime | `gpt-5.6-sol` | high | `apps/wordpress-federation`, `libs/wordpress/nest`, `package.json`, `tsconfig.base.json`, `test/wordpress-federation-refactor.test.mjs`, `test/order-subscription-refactor.test.mjs`, `test/typescript-editor-stability.test.mjs`, `test/milestone-7-nx-quality.test.mjs`, `test/milestone-7-containers.test.mjs`, `test/milestone-7-e2e-contract.test.mjs`, `test/milestone-8-real-e2e.test.mjs`, `test/delivery-closure-inventory-saga.test.mjs` |

#### faixa-3 — branch `spec/remove-wordpress-federation-runtime-faixa-3` — worktree `../onp-worktrees/desafio-dev-backend-senior-remove-wordpress-federation-runtime-faixa-3`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-004 | Align architecture documentation with the plugin-first topology | `gpt-5.6-luna` | low | `README.md`, `docs/adrs/003-wordpress-federation.md`, `docs/adrs/007-federated-platform-boundaries.md`, `docs/adrs/README.md`, `docs/prds/01-arquitetura-e-dominio.md`, `docs/knowledge/Mapa do Projeto.md`, `docs/runbooks/local-development.md`, `docs/runbooks/e2e.md`, `docs/evidence/federated-platform-refactor/review.md` |

## Tarefas sequenciais (após as ondas, na árvore principal)

| tarefa | título | modelo | esforço | por que sequencial |
|---|---|---|---|---|
| T-001 | Define direct WordPress federation acceptance contracts | `gpt-5.6-sol` | high | fora da seleção do usuário |

## Gestão de branches e commits

1. branch de trabalho `spec/remove-wordpress-federation-runtime` criada do ponto atual (se ainda não existir)
2. cada faixa nasce dela como branch própria e roda no seu worktree — **1 tarefa = 1 commit** (`T-xxx feature: título`)
3. terminou a onda → merge `--no-ff` de cada faixa de volta, na ordem; conflito interrompe a faixa e pede resolução humana
4. faixa mesclada → worktree removido, branch apagada, tarefa marcada `[concluida]` no tasks.md
5. gate final na branch de trabalho: `onp-spec verify remove-wordpress-federation-runtime` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/remove-wordpress-federation-runtime/executar-tarefas.sh
```

Cada faixa roda `codex exec` com **janela de contexto limpa**, no seu worktree, com
`--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `danger-full-access`. Os prompts exatos estão
embutidos no script — quer rodar uma faixa na mão, é só copiá-los de lá.
Logs: `../onp-worktrees/desafio-dev-backend-senior-remove-wordpress-federation-runtime-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano remove-wordpress-federation-runtime --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa remove-wordpress-federation-runtime T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo remove-wordpress-federation-runtime --tabela   # a tabela de andamento
onp-spec resumo remove-wordpress-federation-runtime            # o resumo em texto
```
