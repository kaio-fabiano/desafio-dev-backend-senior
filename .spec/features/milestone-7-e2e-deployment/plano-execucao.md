# Plano de execução — milestone-7-e2e-deployment

> gerado por `onp-spec plano` em 2026-08-27 19:18 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano milestone-7-e2e-deployment`

## Resumo — o que vai acontecer

- **7 tarefa(s) pendente(s)**: 7 em 5 faixa(s) paralela(s) + 0 sequencial(is)
- **1 faixa = 1 worktree + 1 branch + 1 janela de contexto limpa** — faixas não compartilham nenhum arquivo entre si
- prefere outra seleção ou uma após a outra? Regenere com `onp-spec plano milestone-7-e2e-deployment --paralelizar T-xxx,T-yyy` ou `--sequencial`
- tudo acontece na branch de trabalho `spec/milestone-7-e2e-deployment`; levar para a main é decisão sua

## Faixas e ondas

### Onda 1 — faixa-1 ∥ faixa-2 ∥ faixa-3

#### faixa-1 — branch `spec/milestone-7-e2e-deployment-faixa-1` — worktree `../onp-worktrees/desafio-dev-backend-senior-milestone-7-e2e-deployment-faixa-1`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-046 | Trace mandatory delivery requirements | `gpt-5.6-luna` | low | `docs/evidence/milestone-7/requirements.md`, `test/milestone-7-delivery-contract.test.mjs` |

#### faixa-2 — branch `spec/milestone-7-e2e-deployment-faixa-2` — worktree `../onp-worktrees/desafio-dev-backend-senior-milestone-7-e2e-deployment-faixa-2`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-047 | Complete the cross-language Nx quality graph | `gpt-5.6-terra` | medium | `nx.json`, `package.json`, `apps/gateway/project.json`, `apps/identity-subgraph/project.json`, `apps/commerce-subgraph/project.json`, `apps/stock-worker/project.json`, `apps/payment-processor/project.json`, `test/milestone-7-nx-quality.test.mjs` |
| T-049 | Implement the complete Testcontainers acceptance journey | `gpt-5.6-sol` | high | `package.json`, `pnpm-lock.yaml`, `apps/e2e/project.json`, `apps/e2e/src/milestone-7.e2e.test.ts`, `apps/e2e/src/environment.ts`, `apps/e2e/src/journey.ts`, `test/milestone-7-e2e-contract.test.mjs` |
| T-050 | Enforce coverage, P95, and N+1 budgets | `gpt-5.6-terra` | medium | `package.json`, `apps/poc-harness/project.json`, `test/milestone-7-coverage.test.mjs`, `test/milestone-7-load.test.mjs`, `docs/evidence/milestone-7/quality.md` |

#### faixa-3 — branch `spec/milestone-7-e2e-deployment-faixa-3` — worktree `../onp-worktrees/desafio-dev-backend-senior-milestone-7-e2e-deployment-faixa-3`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-048 | Harden final application images and Compose readiness | `gpt-5.6-terra` | medium | `compose.yaml`, `apps/gateway/Dockerfile`, `apps/identity-subgraph/Dockerfile`, `apps/commerce-subgraph/Dockerfile`, `apps/stock-worker/Dockerfile`, `apps/payment-processor/Dockerfile`, `apps/apollo-mcp/Dockerfile`, `test/milestone-7-containers.test.mjs` |

### Onda 2 — faixa-4 ∥ faixa-5

#### faixa-4 — branch `spec/milestone-7-e2e-deployment-faixa-4` — worktree `../onp-worktrees/desafio-dev-backend-senior-milestone-7-e2e-deployment-faixa-4`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-051 | Add the pinned SST v3 stack and protected CI delivery path | `gpt-5.6-sol` | high | `infra/sst.config.ts`, `infra/package.json`, `infra/tsconfig.json`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `test/milestone-7-sst.test.mjs` |

#### faixa-5 — branch `spec/milestone-7-e2e-deployment-faixa-5` — worktree `../onp-worktrees/desafio-dev-backend-senior-milestone-7-e2e-deployment-faixa-5`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-052 | Publish final runbooks, operation collection, and evidence index | `gpt-5.6-luna` | low | `README.md`, `docs/runbooks/local-development.md`, `docs/runbooks/e2e.md`, `docs/runbooks/deployment.md`, `docs/operations/marketplace.http`, `docs/evidence/mcp/README.md`, `docs/evidence/milestone-7/README.md`, `test/milestone-7-documentation.test.mjs` |

## Gestão de branches e commits

1. branch de trabalho `spec/milestone-7-e2e-deployment` criada do ponto atual (se ainda não existir)
2. cada faixa nasce dela como branch própria e roda no seu worktree — **1 tarefa = 1 commit** (`T-xxx feature: título`)
3. terminou a onda → merge `--no-ff` de cada faixa de volta, na ordem; conflito interrompe a faixa e pede resolução humana
4. faixa mesclada → worktree removido, branch apagada, tarefa marcada `[concluida]` no tasks.md
5. gate final na branch de trabalho: `onp-spec verify milestone-7-e2e-deployment` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/milestone-7-e2e-deployment/executar-tarefas.sh
```

Cada faixa roda `codex exec` com **janela de contexto limpa**, no seu worktree, com
`--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `workspace-write`. Os prompts exatos estão
embutidos no script — quer rodar uma faixa na mão, é só copiá-los de lá.
Logs: `../onp-worktrees/desafio-dev-backend-senior-milestone-7-e2e-deployment-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano milestone-7-e2e-deployment --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa milestone-7-e2e-deployment T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo milestone-7-e2e-deployment --tabela   # a tabela de andamento
onp-spec resumo milestone-7-e2e-deployment            # o resumo em texto
```

