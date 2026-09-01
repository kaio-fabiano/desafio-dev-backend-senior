# Plano de execução — production-happy-path-hardening

> gerado por `onp-spec plano` em 2026-09-01 18:24 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano production-happy-path-hardening --paralelizar T-103,T-104`

## Resumo — o que vai acontecer

- **5 tarefa(s) pendente(s)**: 2 em 2 faixa(s) paralela(s) + 3 sequencial(is)
- **seleção do usuário**: paralelizar só T-103, T-104 — as demais rodam uma após a outra, ao final
- **1 faixa = 1 worktree + 1 branch + 1 janela de contexto limpa** — faixas não compartilham nenhum arquivo entre si
- prefere outra seleção ou uma após a outra? Regenere com `onp-spec plano production-happy-path-hardening --paralelizar T-xxx,T-yyy` ou `--sequencial`
- tudo acontece na branch de trabalho `spec/production-happy-path-hardening`; levar para a main é decisão sua

## Faixas e ondas

### Onda 1 — faixa-1 ∥ faixa-2

#### faixa-1 — branch `spec/production-happy-path-hardening-faixa-1` — worktree `../onp-worktrees/workspace-production-happy-path-hardening-faixa-1`

| tarefa | título                                      | modelo        | esforço | arquivos                                                                                                                      |
| ------ | ------------------------------------------- | ------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| T-103  | Make WooCommerce order creation recoverable | `gpt-5.6-sol` | high    | `apps/commerce-subgraph/src/checkout`, `apps/commerce-subgraph/src/persistence`, `apps/commerce-subgraph/src/graphql`, `test` |

#### faixa-2 — branch `spec/production-happy-path-hardening-faixa-2` — worktree `../onp-worktrees/workspace-production-happy-path-hardening-faixa-2`

| tarefa | título                                        | modelo        | esforço | arquivos                                                                                                                                                                              |
| ------ | --------------------------------------------- | ------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-104  | Make the inventory effect durably recoverable | `gpt-5.6-sol` | high    | `apps/payment-processor/src/main/java/dev/desafio/payment/inventory`, `apps/payment-processor/src/main/java/dev/desafio/payment/adapter/messaging`, `apps/payment-processor/src/test` |

## Tarefas sequenciais (após as ondas, na árvore principal)

| tarefa | título                                                  | modelo        | esforço | por que sequencial         |
| ------ | ------------------------------------------------------- | ------------- | ------- | -------------------------- |
| T-102  | Make cart ownership and session propagation federated   | `gpt-5.6-sol` | high    | fora da seleção do usuário |
| T-105  | Make order subscriptions distributed and replayable     | `gpt-5.6-sol` | high    | fora da seleção do usuário |
| T-106  | Refactor NestJS composition and close all quality gates | `gpt-5.6-sol` | high    | fora da seleção do usuário |

## Gestão de branches e commits

1. branch de trabalho `spec/production-happy-path-hardening` criada do ponto atual (se ainda não existir)
2. cada faixa nasce dela como branch própria e roda no seu worktree — **1 tarefa = 1 commit** (`T-xxx feature: título`)
3. terminou a onda → merge `--no-ff` de cada faixa de volta, na ordem; conflito interrompe a faixa e pede resolução humana
4. faixa mesclada → worktree removido, branch apagada, tarefa marcada `[concluida]` no tasks.md
5. gate final na branch de trabalho: `onp-spec verify production-happy-path-hardening` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/production-happy-path-hardening/executar-tarefas.sh
```

Cada faixa roda `codex exec` com **janela de contexto limpa**, no seu worktree, com
`--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `danger-full-access`. Os prompts exatos estão
embutidos no script — quer rodar uma faixa na mão, é só copiá-los de lá.
Logs: `../onp-worktrees/workspace-production-happy-path-hardening-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano production-happy-path-hardening --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa production-happy-path-hardening T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo production-happy-path-hardening --tabela   # a tabela de andamento
onp-spec resumo production-happy-path-hardening            # o resumo em texto
```
