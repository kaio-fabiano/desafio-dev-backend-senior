# Plano de execução — migrate-order-workflow-to-axon-java

> gerado por `onp-spec plano` em 2026-09-09 10:48 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano migrate-order-workflow-to-axon-java --paralelizar T-246,T-247,T-248 --modelo gpt-5.6-sol --esforco high`

## Resumo — o que vai acontecer

- **8 tarefa(s) pendente(s)**: 3 em 3 faixa(s) paralela(s) + 5 sequencial(is) (6 já concluída(s): T-240, T-241, T-242, T-243, T-244, T-245)
- **seleção do usuário**: paralelizar só T-246, T-247, T-248 — as demais rodam uma após a outra, ao final
- **1 faixa = 1 worktree + 1 branch + 1 janela de contexto limpa** — faixas não compartilham nenhum arquivo entre si
- prefere outra seleção ou uma após a outra? Regenere com `onp-spec plano migrate-order-workflow-to-axon-java --paralelizar T-xxx,T-yyy` ou `--sequencial`
- **custo travado pelo usuário**: modelo `gpt-5.6-sol` · esforço `high` em TODAS as tarefas (vence tasks.md e config)
- tudo acontece na branch de trabalho `spec/migrate-order-workflow-to-axon-java`; levar para a main é decisão sua

## Faixas e ondas

### Onda 1 — faixa-1 ∥ faixa-2 ∥ faixa-3

#### faixa-1 — branch `spec/migrate-order-workflow-to-axon-java-faixa-1` — worktree `../onp-worktrees/desafio-dev-backend-senior-migrate-order-workflow-to-axon-java-faixa-1`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-246 | Convert Inventory into an independent Axon participant | `gpt-5.6-sol` | high | `apps/payment-federation/src/main/java/dev/desafio/transaction/inventory`, `apps/payment-federation/src/main/resources/db/migration/inventory`, `apps/payment-federation/src/test/java/dev/desafio/transaction/inventory`, `test/migrate-order-workflow-to-axon-java-inventory.test.mjs` |

#### faixa-2 — branch `spec/migrate-order-workflow-to-axon-java-faixa-2` — worktree `../onp-worktrees/desafio-dev-backend-senior-migrate-order-workflow-to-axon-java-faixa-2`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-247 | Convert Payment and provider effects into Axon | `gpt-5.6-sol` | high | `apps/payment-federation/src/main/java/dev/desafio/transaction/payment`, `apps/payment-federation/src/main/resources/db/migration/payment`, `apps/payment-federation/src/test/java/dev/desafio/transaction/payment`, `test/migrate-order-workflow-to-axon-java-payment.test.mjs` |

#### faixa-3 — branch `spec/migrate-order-workflow-to-axon-java-faixa-3` — worktree `../onp-worktrees/desafio-dev-backend-senior-migrate-order-workflow-to-axon-java-faixa-3`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-248 | Migrate checkout and Transaction decisions | `gpt-5.6-sol` | high | `apps/order-workflow-subgraph/src/checkout`, `apps/payment-federation/src/main/java/dev/desafio/transaction/transaction`, `apps/payment-federation/src/main/resources/db/migration/transaction`, `apps/payment-federation/src/test/java/dev/desafio/transaction/transaction`, `test/migrate-order-workflow-to-axon-java-transaction.test.mjs` |

## Tarefas sequenciais (após as ondas, na árvore principal)

| tarefa | título | modelo | esforço | por que sequencial |
|---|---|---|---|---|
| T-249 | Build replayable projections and compatible GraphQL | `gpt-5.6-sol` | high | fora da seleção do usuário |
| T-250 | Deliver transaction-filtered GraphQL SSE | `gpt-5.6-sol` | high | fora da seleção do usuário |
| T-251 | Prove the complete choreographed lifecycle and compensations | `gpt-5.6-sol` | high | fora da seleção do usuário |
| T-252 | Import or clean-start legacy state and perform reversible cutover | `gpt-5.6-sol` | high | fora da seleção do usuário |
| T-253 | Retire Node Workflow and close all quality gates | `gpt-5.6-sol` | high | fora da seleção do usuário |

## Gestão de branches e commits

1. branch de trabalho `spec/migrate-order-workflow-to-axon-java` criada do ponto atual (se ainda não existir)
2. cada faixa nasce dela como branch própria e roda no seu worktree — **1 tarefa = 1 commit** (`T-xxx feature: título`)
3. terminou a onda → merge `--no-ff` de cada faixa de volta, na ordem; conflito interrompe a faixa e pede resolução humana
4. faixa mesclada → worktree removido, branch apagada, tarefa marcada `[concluida]` no tasks.md
5. gate final na branch de trabalho: `onp-spec verify migrate-order-workflow-to-axon-java` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/migrate-order-workflow-to-axon-java/executar-tarefas.sh
```

Cada faixa roda `codex exec` com **janela de contexto limpa**, no seu worktree, com
`--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `danger-full-access`. Os prompts exatos estão
embutidos no script — quer rodar uma faixa na mão, é só copiá-los de lá.
Logs: `../onp-worktrees/desafio-dev-backend-senior-migrate-order-workflow-to-axon-java-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano migrate-order-workflow-to-axon-java --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa migrate-order-workflow-to-axon-java T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo migrate-order-workflow-to-axon-java --tabela   # a tabela de andamento
onp-spec resumo migrate-order-workflow-to-axon-java            # o resumo em texto
```

