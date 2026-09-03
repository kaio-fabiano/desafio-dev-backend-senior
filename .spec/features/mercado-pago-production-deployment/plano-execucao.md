# Plano de execução — mercado-pago-production-deployment

> gerado por `onp-spec plano` em 2026-09-03 07:00 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano mercado-pago-production-deployment --paralelizar T-146,T-147,T-148`

## Resumo — o que vai acontecer

- **4 tarefa(s) pendente(s)**: 3 em 1 faixa(s) paralela(s) + 1 sequencial(is)
- **seleção do usuário**: paralelizar só T-146, T-147, T-148 — as demais rodam uma após a outra, ao final
- **1 faixa = 1 worktree + 1 branch + 1 janela de contexto limpa** — faixas não compartilham nenhum arquivo entre si
- prefere outra seleção ou uma após a outra? Regenere com `onp-spec plano mercado-pago-production-deployment --paralelizar T-xxx,T-yyy` ou `--sequencial`
- tudo acontece na branch de trabalho `spec/mercado-pago-production-deployment`; levar para a main é decisão sua

## Faixas e ondas

### Onda 1 — faixa-1

#### faixa-1 — branch `spec/mercado-pago-production-deployment-faixa-1` — worktree `../onp-worktrees/desafio-dev-backend-senior-mercado-pago-production-deployment-faixa-1`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-146 | Run and repair the complete credential-free quality gate | `gpt-5.6-sol` | high | `package.json`, `apps/e2e/project.json`, `test/mercado-pago-production-deployment.test.mjs`, `docs/evidence/mercado-pago-production-deployment/credential-free-gate.md` |
| T-147 | Automate redacted Mercado Pago test-environment verification | `gpt-5.6-sol` | high | `apps/e2e/src/mercado-pago-sandbox.test.ts`, `apps/e2e/src/mercado-pago-sandbox.ts`, `apps/e2e/project.json`, `docs/runbooks/mercado-pago-sandbox.md`, `test/mercado-pago-production-deployment.test.mjs` |
| T-148 | Complete secret-backed SST runtime and deployment checks | `gpt-5.6-sol` | high | `infra/sst.config.ts`, `infra/package.json`, `apps/payment-federation/Dockerfile`, `apps/order-workflow-subgraph/Dockerfile`, `apps/gateway/Dockerfile`, `apps/identity-subgraph/Dockerfile`, `apps/apollo-mcp/Dockerfile`, `test/mercado-pago-production-deployment.test.mjs`, `docs/runbooks/deployment.md` |

## Tarefas sequenciais (após as ondas, na árvore principal)

| tarefa | título | modelo | esforço | por que sequencial |
|---|---|---|---|---|
| T-149 | Deploy the approved stage and run release smoke tests | `gpt-5.6-sol` | high | fora da seleção do usuário |

## Gestão de branches e commits

1. branch de trabalho `spec/mercado-pago-production-deployment` criada do ponto atual (se ainda não existir)
2. cada faixa nasce dela como branch própria e roda no seu worktree — **1 tarefa = 1 commit** (`T-xxx feature: título`)
3. terminou a onda → merge `--no-ff` de cada faixa de volta, na ordem; conflito interrompe a faixa e pede resolução humana
4. faixa mesclada → worktree removido, branch apagada, tarefa marcada `[concluida]` no tasks.md
5. gate final na branch de trabalho: `onp-spec verify mercado-pago-production-deployment` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/mercado-pago-production-deployment/executar-tarefas.sh
```

Cada faixa roda `codex exec` com **janela de contexto limpa**, no seu worktree, com
`--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `danger-full-access`. Os prompts exatos estão
embutidos no script — quer rodar uma faixa na mão, é só copiá-los de lá.
Logs: `../onp-worktrees/desafio-dev-backend-senior-mercado-pago-production-deployment-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano mercado-pago-production-deployment --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa mercado-pago-production-deployment T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo mercado-pago-production-deployment --tabela   # a tabela de andamento
onp-spec resumo mercado-pago-production-deployment            # o resumo em texto
```

