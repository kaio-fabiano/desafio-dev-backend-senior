# Plano de execução — milestone-8-compliance-hardening

> gerado por `onp-spec plano` em 2026-08-27 22:13 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano milestone-8-compliance-hardening`

## Resumo — o que vai acontecer

- **8 tarefa(s) pendente(s)**: 8 em 3 faixa(s) paralela(s) + 0 sequencial(is)
- **1 faixa = 1 worktree + 1 branch + 1 janela de contexto limpa** — faixas não compartilham nenhum arquivo entre si
- prefere outra seleção ou uma após a outra? Regenere com `onp-spec plano milestone-8-compliance-hardening --paralelizar T-xxx,T-yyy` ou `--sequencial`
- tudo acontece na branch de trabalho `spec/milestone-8-compliance-hardening`; levar para a main é decisão sua

## Faixas e ondas

### Onda 1 — faixa-1 ∥ faixa-2 ∥ faixa-3

#### faixa-1 — branch `spec/milestone-8-compliance-hardening-faixa-1` — worktree `../onp-worktrees/desafio-dev-backend-senior-milestone-8-compliance-hardening-faixa-1`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-053 | Establish the honest compliance gate | `gpt-5.6-luna` | low | `docs/evidence/milestone-8/review.md`, `docs/evidence/milestone-8/requirements.md`, `test/milestone-8-compliance-contract.test.mjs`, `onpspec.config.json` |

#### faixa-2 — branch `spec/milestone-8-compliance-hardening-faixa-2` — worktree `../onp-worktrees/desafio-dev-backend-senior-milestone-8-compliance-hardening-faixa-2`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-054 | Repair the reproducible Nx quality toolchain | `gpt-5.6-terra` | medium | `eslint.config.mjs`, `package.json`, `pnpm-lock.yaml`, `nx.json`, `apps/payment-processor/project.json`, `test/milestone-8-quality-gate.test.mjs` |
| T-055 | Complete Identity and Gateway federation runtime | `gpt-5.6-sol` | high | `libs/contracts/graphql/identity/schema.graphql`, `libs/contracts/graphql/supergraph.yaml`, `apps/identity-subgraph/src`, `apps/gateway/src`, `apps/identity-subgraph/project.json`, `apps/gateway/project.json`, `test/milestone-8-identity-gateway.test.mjs` |
| T-056 | Complete Commerce runtime composition | `gpt-5.6-sol` | high | `libs/contracts/graphql/commerce/schema.graphql`, `apps/commerce-subgraph/src`, `apps/commerce-subgraph/project.json`, `test/milestone-8-commerce-runtime.test.mjs` |
| T-057 | Complete payment and inventory worker runtime | `gpt-5.6-sol` | high | `apps/payment-processor/src`, `apps/payment-processor/build.gradle.kts`, `apps/stock-worker/src`, `apps/stock-worker/project.json`, `test/milestone-8-worker-runtime.test.mjs` |
| T-058 | Replace the simulated E2E with the delivered system | `gpt-5.6-sol` | high | `apps/e2e/src/environment.ts`, `apps/e2e/src/journey.ts`, `apps/e2e/src/milestone-7.e2e.test.ts`, `apps/e2e/project.json`, `apps/identity-subgraph/project.json`, `apps/gateway/project.json`, `apps/commerce-subgraph/project.json`, `apps/stock-worker/project.json`, `apps/payment-processor/build.gradle.kts`, `compose.yaml`, `test/milestone-7-e2e-contract.test.mjs`, `test/milestone-8-real-e2e.test.mjs` |
| T-059 | Retire obsolete PoC project structure | `gpt-5.6-terra` | medium | `apps/poc-auth`, `apps/poc-sse`, `apps/poc-harness`, `apps/poc-wordpress`, `apps/wordpress-integration`, `apps/e2e/project.json`, `docs/adrs`, `docs/runbooks`, `test/marco-0-auth.test.mjs`, `test/marco-0-sse.test.mjs`, `test/marco-0-wordpress.test.mjs`, `pnpm-workspace.yaml`, `pnpm-lock.yaml` |

#### faixa-3 — branch `spec/milestone-8-compliance-hardening-faixa-3` — worktree `../onp-worktrees/desafio-dev-backend-senior-milestone-8-compliance-hardening-faixa-3`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-060 | Harden offline SST and delivery documentation | `gpt-5.6-luna` | low | `infra/sst.config.ts`, `infra/tsconfig.json`, `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `docs/runbooks/deployment.md`, `test/milestone-8-offline-infra.test.mjs` |

## Gestão de branches e commits

1. branch de trabalho `spec/milestone-8-compliance-hardening` criada do ponto atual (se ainda não existir)
2. cada faixa nasce dela como branch própria e roda no seu worktree — **1 tarefa = 1 commit** (`T-xxx feature: título`)
3. terminou a onda → merge `--no-ff` de cada faixa de volta, na ordem; conflito interrompe a faixa e pede resolução humana
4. faixa mesclada → worktree removido, branch apagada, tarefa marcada `[concluida]` no tasks.md
5. gate final na branch de trabalho: `onp-spec verify milestone-8-compliance-hardening` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/milestone-8-compliance-hardening/executar-tarefas.sh
```

Cada faixa roda `codex exec` com **janela de contexto limpa**, no seu worktree, com
`--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `workspace-write`. Os prompts exatos estão
embutidos no script — quer rodar uma faixa na mão, é só copiá-los de lá.
Logs: `../onp-worktrees/desafio-dev-backend-senior-milestone-8-compliance-hardening-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano milestone-8-compliance-hardening --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa milestone-8-compliance-hardening T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo milestone-8-compliance-hardening --tabela   # a tabela de andamento
onp-spec resumo milestone-8-compliance-hardening            # o resumo em texto
```

