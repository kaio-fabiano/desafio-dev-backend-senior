# Plano de execução — refactor-checkout-operation-flow

> gerado por `onp-spec plano` em 2026-09-11 07:37 — NÃO edite à mão;
> mudou tasks.md ou a config? Regenere: `onp-spec plano refactor-checkout-operation-flow --sequencial --modelo gpt-5.6-luna --esforco low`

## Resumo — o que vai acontecer

- **modo SEQUENCIAL (escolha do usuário)**: 9 tarefa(s) pendente(s), UMA APÓS A OUTRA, na árvore principal
- sem worktrees e sem paralelismo — cada tarefa roda numa janela de contexto limpa, na ordem do tasks.md
- **custo travado pelo usuário**: modelo `gpt-5.6-luna` · esforço `low` em TODAS as tarefas (vence tasks.md e config)
- tudo acontece na branch de trabalho `spec/refactor-checkout-operation-flow`; levar para a main é decisão sua

## Ordem de execução (uma tarefa após a outra)

| tarefa | título | modelo | esforço |
|---|---|---|---|
| T-287 | Add the complete failing checkout acceptance matrix | `gpt-5.6-luna` | low |
| T-288 | Introduce deterministic checkout identity and Axon routing | `gpt-5.6-luna` | low |
| T-289 | Replace checkout claims with durable PostgreSQL operation transitions | `gpt-5.6-luna` | low |
| T-290 | Make checkout return state and dispatch Transaction asynchronously | `gpt-5.6-luna` | low |
| T-291 | Preserve WooCommerce uncertain-result reconciliation | `gpt-5.6-luna` | low |
| T-292 | Return and stream CheckoutOperation through existing GraphQL SSE | `gpt-5.6-luna` | low |
| T-293 | Verify deterministic Payment and Transaction external identities | `gpt-5.6-luna` | low |
| T-294 | Make Transaction state and RabbitMQ outbox one transaction | `gpt-5.6-luna` | low |
| T-295 | Remove legacy checkout concurrency and close every gate | `gpt-5.6-luna` | low |

## Gestão de branches e commits

1. branch de trabalho `spec/refactor-checkout-operation-flow` criada do ponto atual (se ainda não existir)
2. as tarefas rodam nela mesma, na ordem — **1 tarefa = 1 commit** (`T-xxx feature: título`), marcada `[concluida]` só com trabalho feito
3. gate final na branch de trabalho: `onp-spec verify refactor-checkout-operation-flow` + `onp-spec audit --ci` — **exit 0 ou não está pronto**

## Como executar

### ▶ Execução — Codex headless (codex exec)

```bash
bash .spec/features/refactor-checkout-operation-flow/executar-tarefas.sh
```

Cada tarefa roda `codex exec` com **janela de contexto limpa**, na árvore principal,
uma após a outra, com `--model` e `model_reasoning_effort` já definidos por tarefa e sandbox `danger-full-access`.
Os prompts exatos estão embutidos no script.
Logs: `../onp-worktrees/desafio-dev-backend-senior-refactor-checkout-operation-flow-logs/`.

**Confirmação de custos — antes de executar**: os modelos e esforços por
tarefa estão nas tabelas acima; o agente CONFIRMA com o usuário se estão
dentro da licença/cota dele (modelo forte + esforço alto torra tokens).
Para gastar menos: `onp-spec plano refactor-checkout-operation-flow --modelo gpt-5.6-luna --esforco baixo`
(tudo) ou por tarefa `onp-spec tarefa refactor-checkout-operation-flow T-xxx --modelo <m> --esforco <nível>` — e regenere o plano.

### 📣 Acompanhamento — tabela + resumo no chat (a cada 1 min)

O script roda em **background**: o agente AVISA o usuário antes de iniciar e,
enquanto roda, posta no chat a cada ~1 minuto a **tabela de andamento** (qual
tarefa está rodando, qual não está, o que concluiu/falhou) junto com o
**resumo geral de andamento** (escrito por IA; sem IA, o motor resume). Ao
final, o usuário recebe o resumo completo da execução. A qualquer momento:

```bash
onp-spec resumo refactor-checkout-operation-flow --tabela   # a tabela de andamento
onp-spec resumo refactor-checkout-operation-flow            # o resumo em texto
```

