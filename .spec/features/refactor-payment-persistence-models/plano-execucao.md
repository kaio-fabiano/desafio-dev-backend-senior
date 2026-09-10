# Plano de execução — refactor-payment-persistence-models

> gerado por `onp-spec plano` em 2026-09-10 14:25 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano refactor-payment-persistence-models --paralelizar T-260,T-261,T-262,T-263`

## Resumo — o que vai acontecer

- **5 tarefa(s) pendente(s)**: 4 em 4 faixa(s) paralela(s) + 1 sequencial(is)
- **seleção do usuário**: paralelizar só T-260, T-261, T-262, T-263 — as demais rodam uma após a outra, ao final
- **1 faixa = 1 worktree + 1 branch + 1 janela de contexto limpa** — faixas não compartilham nenhum arquivo entre si
- prefere outra seleção ou uma após a outra? Regenere com `onp-spec plano refactor-payment-persistence-models --paralelizar T-xxx,T-yyy` ou `--sequencial`
- tudo acontece na branch de trabalho `spec/refactor-payment-persistence-models`; levar para a main é decisão sua

## Faixas e ondas

### Onda 1 — faixa-1 ∥ faixa-2 ∥ faixa-3

#### faixa-1 — branch `spec/refactor-payment-persistence-models-faixa-1` — worktree `../onp-worktrees/desafio-dev-backend-senior-refactor-payment-orm-refactor-payment-persistence-models-faixa-1`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-260 | Model Inventory persistence with JPA | `gpt-5.6-sol` | high | `apps/payment-federation/src/main/java/dev/desafio/transaction/inventory`, `apps/payment-federation/src/main/resources/db/migration/inventory`, `apps/payment-federation/src/test/java/dev/desafio/transaction/inventory`, `test/refactor-payment-persistence-inventory.test.mjs` |

#### faixa-2 — branch `spec/refactor-payment-persistence-models-faixa-2` — worktree `../onp-worktrees/desafio-dev-backend-senior-refactor-payment-orm-refactor-payment-persistence-models-faixa-2`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-261 | Model Payment persistence with JPA | `gpt-5.6-sol` | high | `apps/payment-federation/src/main/java/dev/desafio/transaction/payment`, `apps/payment-federation/src/main/resources/db/migration/payment`, `apps/payment-federation/src/test/java/dev/desafio/transaction/payment`, `apps/payment-federation/src/test/java/dev/desafio/payment`, `test/refactor-payment-persistence-payment.test.mjs` |

#### faixa-3 — branch `spec/refactor-payment-persistence-models-faixa-3` — worktree `../onp-worktrees/desafio-dev-backend-senior-refactor-payment-orm-refactor-payment-persistence-models-faixa-3`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-262 | Model Transaction persistence with JPA | `gpt-5.6-sol` | high | `apps/payment-federation/src/main/java/dev/desafio/transaction/transaction`, `apps/payment-federation/src/main/resources/db/migration/transaction`, `apps/payment-federation/src/test/java/dev/desafio/transaction/transaction`, `test/refactor-payment-persistence-transaction.test.mjs` |

### Onda 2 — faixa-4

#### faixa-4 — branch `spec/refactor-payment-persistence-models-faixa-4` — worktree `../onp-worktrees/desafio-dev-backend-senior-refactor-payment-orm-refactor-payment-persistence-models-faixa-4`

| tarefa | título | modelo | esforço | arquivos |
|---|---|---|---|---|
| T-263 | Model shared AMQP delivery persistence with JPA | `gpt-5.6-sol` | high | `apps/payment-federation/src/main/java/dev/desafio/transaction/shared/infrastructure/persistence`, `apps/payment-federation/src/main/java/dev/desafio/transaction/shared/infrastructure/messaging`, `apps/payment-federation/src/test/java/dev/desafio/transaction/infrastructure/messaging`, `test/refactor-payment-persistence-amqp.test.mjs` |

## Tarefas sequenciais (após as ondas, na árvore principal)

| tarefa | título | modelo | esforço | por que sequencial |
|---|---|---|---|---|
| T-264 | Integrate ORM adapters and enforce the zero-SQL runtime boundary | `gpt-5.6-sol` | high | fora da seleção do usuário |

## Gestão de branches e commits

1. branch de trabalho `spec/refactor-payment-persistence-models` criada do ponto atual (se ainda não existir)
2. cada faixa nasce dela como branch própria e roda no seu worktree — **1 tarefa = 1 commit** (`T-xxx feature: título`)
3. terminou a onda → merge `--no-ff` de cada faixa de volta, na ordem; conflito interrompe a faixa e pede resolução humana
4. faixa mesclada → worktree removido, branch apagada, tarefa marcada `[concluida]` no tasks.md
5. gate final na branch de trabalho: `onp-spec verify refactor-payment-persistence-models` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/refactor-payment-persistence-models/executar-tarefas.sh
```

Cada faixa roda `codex exec` com **janela de contexto limpa**, no seu worktree, com
`--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `danger-full-access`. Os prompts exatos estão
embutidos no script — quer rodar uma faixa na mão, é só copiá-los de lá.
Logs: `../onp-worktrees/desafio-dev-backend-senior-refactor-payment-orm-refactor-payment-persistence-models-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano refactor-payment-persistence-models --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa refactor-payment-persistence-models T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo refactor-payment-persistence-models --tabela   # a tabela de andamento
onp-spec resumo refactor-payment-persistence-models            # o resumo em texto
```

